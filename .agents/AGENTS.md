
<!-- BEGIN:master-plan-management -->
# Artifact Management & Master Plans
Use a strictly enforced 3-tier hierarchy for planning documents and execution. Follow this exact lifecycle for every task:

1. **Ideation & Discussion (`discussion_*.md`)**: 
   - When the user prompts with a task, opinion, or question, write the analysis/options in a `discussion_*.md` file.
   - Wait for the user to overview it, add comments, and approve ("Proceed").
   - Iterate on the discussion file if the user adds feedback.

2. **Pre-Implementation (`staging_plan.md`)**:
   - Before writing any code, note down the final findings, decisions, and technical implementation details in `staging_plan.md`.

3. **Implementation & Iteration**:
   - Write the code. Update `staging_plan.md` with any actual solutions or deviations encountered during implementation.
   - Go back and forth with the user on fixes.

4. **Finalization (`master_architecture_plan.md`)**:
   - When the user is completely satisfied with the implemented feature/fix, append the completed work in a **compact way** to the `master_architecture_plan.md`.
   - This ensures the Master Plan always contains the full, accurate context of the current system.
<!-- END:master-plan-management -->

