const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/dashComponents/TasksSidebar.tsx', 'utf8');
const updated = content.replace(/sizeClass="([^"]+)"\r?\n\s*\/>/g, (match, p1) => {
  return `sizeClass="${p1}"\n                        onDelete={async () => {\n                          if (confirm('Delete this capture?')) {\n                            const res = await deleteCapture(task.id);\n                            if (res.success) toast.success('Capture deleted');\n                            else toast.error(res.error || 'Failed to delete');\n                          }\n                        }}\n                      />`;
});
fs.writeFileSync('src/app/dashboard/dashComponents/TasksSidebar.tsx', updated);
