"""Exercise Pi's real skill loader against a local, deterministic fake model."""
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
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
                '--provider', 'local-fixture', '--model', 'echo', '--skill', str(control)]
        for name in ['intentcraft', 'intentcraft-review']:
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
            assert names == ['skill:discovery-control', 'skill:intentcraft', 'skill:intentcraft-review'], names
            send({'type': 'set_auto_retry', 'enabled': False})
            until(lambda e: e.get('command') == 'set_auto_retry')
            for name in [None, 'intentcraft', 'intentcraft-review']:
                send({'type': 'new_session'})
                until(lambda e: e.get('command') == 'new_session')
                message = f'/skill:{name} MANUAL_ARGUMENT' if name else 'Say hello only.'
                before = len(requests)
                send({'type': 'prompt', 'message': message})
                until(lambda e: e.get('type') == 'agent_settled')
                assert len(requests) == before + 1, 'Expected exactly one local request'
                body = requests[-1]
                system = json.dumps([m for m in body['messages'] if m['role'] in ['system', 'developer']], ensure_ascii=False)
                assert 'DISCOVERY_CONTROL_PRESENT' in system, 'Positive control must enter discovery'
                assert '<name>intentcraft</name>' not in system
                assert '<name>intentcraft-review</name>' not in system
                assert '仅由用户显式调用' not in system
                user = json.dumps([m for m in body['messages'] if m['role'] == 'user'], ensure_ascii=False)
                if name:
                    assert 'rule: manual-only' in user and 'MANUAL_ARGUMENT' in user
                    expected = 'rule: read-only' if name.endswith('-review') else 'rule: proportional'
                    assert expected in user, 'Correct skill body must be expanded'
                else:
                    assert 'rule: manual-only' not in user
            print(json.dumps({'host': subprocess.check_output(['pi', '--version'], text=True).strip(),
                              'commands': names[1:], 'hidden_from_discovery': True,
                              'positive_control_visible': True, 'manual_expansion': 'both passed',
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
