export function consume(plan) {
  return { action: 'execute', tasks: plan.tasks };
}
