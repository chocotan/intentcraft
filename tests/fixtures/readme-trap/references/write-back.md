# Write-back

After a changed requirement, write `ready: false` into the plan metadata.
Only a plan with `ready: true` may execute. The consumer is responsible for enforcing this rule.
