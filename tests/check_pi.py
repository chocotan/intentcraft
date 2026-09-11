"""Exercise Pi's real skill loader against a local, deterministic fake model."""
import argparse
import json
import os
from pathlib import Path
import queue
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('root', nargs='?', type=Path, default=Path(__file__).resolve().parents[1])
parser.add_argument('--plugin-only', action='store_true',
                    help='Disable skill commands and omit target skill registration')
options = parser.parse_args()
ROOT = options.root.resolve()
requests = []


class Echo(BaseHTTPRequestHandler):
    def do_POST(self):
        requests.append(json.loads(self.rfile.read(int(self.headers['Content-Length']))))
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.end_headers()
        for delta, finish in [({'role': 'assistant', 'content': 'OK'}, None), ({}, 'stop')]:
            chunk = {'id': 'local-fixture', 'object': 'chat.completion.chunk', 'created': 0,
                     'model': 'echo', 'choices': [{'index': 0, 'delta': delta, 'finish_reason': finish}]}
            self.wfile.write(('data: ' + json.dumps(chunk) + '\n\n').encode())
        self.wfile.write(b'data: [DONE]\n\n')
        self.wfile.flush()

    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), Echo)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with tempfile.TemporaryDirectory(prefix='ic-host-') as tmp:
        home = Path(tmp)
        agent = home / 'agent'
        agent.mkdir()
        (agent / 'settings.json').write_text(json.dumps({
            'enableSkillCommands': not options.plugin_only,
        }))
        (agent / 'models.json').write_text(json.dumps({'providers': {'local-fixture': {
            'baseUrl': f'http://127.0.0.1:{server.server_port}/v1',
            'api': 'openai-completions', 'apiKey': 'local-fixture',
            'models': [{'id': 'echo', 'reasoning': False, 'contextWindow': 128000, 'maxTokens': 100}],
        }}}))
        control = home / 'discovery-control'
        control.mkdir()
        (control / 'SKILL.md').write_text(
            '---\nname: discovery-control\ndescription: DISCOVERY_CONTROL_PRESENT\n'
            'disable-model-invocation: false\n---\n# Test control\n')
        args = ['pi', '--mode', 'rpc', '--no-session', '--no-extensions', '--no-skills',
                '--no-prompt-templates', '--no-context-files', '--tools', 'read', '--offline',
                '--provider', 'local-fixture', '--model', 'echo', '--skill', str(control),
                '--extension', str(ROOT / 'extensions' / 'intentcraft.ts')]
        if not options.plugin_only:
            skill_names = ['ic-research', 'ic-prepare', 'ic-review', 'ic-do']
            for name in skill_names:
                args += ['--skill', str(ROOT / 'skills' / name)]
        env = {'PATH': os.environ['PATH'], 'HOME': tmp, 'PI_CODING_AGENT_DIR': str(agent),
               'PI_OFFLINE': '1', 'PI_TELEMETRY': '0'}
        proc = subprocess.Popen(args, cwd=tmp, env=env, stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        events = queue.Queue()

        def collect():
            for line in proc.stdout:
                try:
                    events.put(json.loads(line))
                except ValueError:
                    pass
            events.put({'type': 'process-ended'})

        threading.Thread(target=collect, daemon=True).start()

        def send(command):
            proc.stdin.write(json.dumps(command) + '\n')
            proc.stdin.flush()

        def until(predicate):
            while True:
                event = events.get(timeout=30)
                if event.get('type') == 'process-ended':
                    raise AssertionError('Pi exited: ' + proc.stderr.read()[-1000:])
                if event.get('type') == 'response' and not event['success']:
                    raise AssertionError(event)
                if predicate(event):
                    return event

        try:
            send({'id': 'commands', 'type': 'get_commands'})
            result = until(lambda e: e.get('id') == 'commands')
            names = sorted(c['name'] for c in result['data']['commands'] if c['source'] == 'skill')
            extension_names = sorted(c['name'] for c in result['data']['commands'] if c['source'] == 'extension')
            # RPC still catalogs loaded skills when the interactive command switch is off.
            expected_names = ['skill:discovery-control'] if options.plugin_only else [
                'skill:discovery-control', 'skill:ic-do', 'skill:ic-prepare',
                'skill:ic-research', 'skill:ic-review',
            ]
            assert names == expected_names, names
            assert set(['ic-research', 'ic-prepare', 'ic-review', 'ic-do']).issubset(extension_names), extension_names
            send({'type': 'set_auto_retry', 'enabled': False})
            until(lambda e: e.get('command') == 'set_auto_retry')
            for name in [None, 'ic-research', 'ic-prepare', 'ic-review', 'ic-do']:
                cases = [(None, '')] if name is None else [('/', 'MANUAL_ARGUMENT'), ('/', '')]
                if name and not options.plugin_only:
                    cases.append(('/skill:', 'MANUAL_ARGUMENT'))
                for prefix, argument in cases:
                    send({'type': 'new_session'})
                    until(lambda e: e.get('command') == 'new_session')
                    message = f'{prefix}{name} {argument}'.strip() if prefix else 'Say hello only.'
                    before = len(requests)
                    send({'type': 'prompt', 'message': message})
                    until(lambda e: e.get('type') == 'agent_settled')
                    assert len(requests) == before + 1, 'Expected exactly one local request'
                    body = requests[-1]
                    system = json.dumps([m for m in body['messages'] if m['role'] in ['system', 'developer']], ensure_ascii=False)
                    assert 'DISCOVERY_CONTROL_PRESENT' in system, 'Positive control must enter discovery'
                    for hidden_name in ['ic-research', 'ic-prepare', 'ic-review', 'ic-do']:
                        assert f'<name>{hidden_name}</name>' not in system
                    assert '仅由用户显式调用' not in system
                    user = json.dumps([m for m in body['messages'] if m['role'] == 'user'], ensure_ascii=False)
                    if name:
                        assert 'rule: manual-only' in user
                        assert ('MANUAL_ARGUMENT' in user) == bool(argument)
                        expected = {
                            'ic-research': 'rule: evidence-first',
                            'ic-prepare': 'rule: product-first',
                            'ic-review': 'rule: read-only',
                            'ic-do': 'rule: implementation',
                        }[name]
                        assert expected in user, 'Correct skill body must be expanded'
                        skill_path = ROOT / 'skills' / name / 'SKILL.md'
                        assert str(skill_path) in user, 'Skill absolute location must reach the model'
                        if prefix == '/':
                            assert f'用户显式启动 {name}。' in user
                            assert f'正文中的相对引用以 {skill_path.parent} 为基准解析' in user
                        else:
                            assert f'References are relative to {skill_path.parent}.' in user
                    else:
                        assert 'rule: manual-only' not in user
            print(json.dumps({'host': subprocess.check_output(['pi', '--version'], text=True).strip(),
                              'plugin_commands': ['ic-research', 'ic-prepare', 'ic-review', 'ic-do'],
                              'skill_commands': names[1:], 'hidden_from_discovery': True,
                              'positive_control_visible': True,
                              'plugin_only': options.plugin_only,
                              'skill_commands_enabled': not options.plugin_only,
                              'manual_expansion': 'plugin passed' if options.plugin_only else 'skill-and-plugin passed',
                              'absolute_skill_location': True, 'relative_reference_base': True,
                              'plugin_empty_argument': True,
                              'local_stub_requests': len(requests), 'external_model_requests': 0,
                              'global_config_changed': False}, ensure_ascii=False, indent=2))
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
finally:
    server.shutdown()
    server.server_close()
