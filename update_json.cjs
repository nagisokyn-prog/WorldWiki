const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'apps/spa/public/struct/editor');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

let totalReplaced = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace calendar_date with calendar_datetime
  if (content.includes('"type": "calendar_date"')) {
    content = content.replace(/"type": "calendar_date"/g, '"type": "calendar_datetime"');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
    totalReplaced++;
  }
}

// Also check templates_dump.json
const templatesDumpPath = path.join(__dirname, 'templates_dump.json');
if (fs.existsSync(templatesDumpPath)) {
  let dumpContent = fs.readFileSync(templatesDumpPath, 'utf8');
  if (dumpContent.includes('(calendar_date)')) {
    dumpContent = dumpContent.replace(/\(calendar_date\)/g, '(calendar_datetime)');
    fs.writeFileSync(templatesDumpPath, dumpContent, 'utf8');
    console.log('Updated templates_dump.json');
    totalReplaced++;
  }
}

console.log(`Finished! Updated ${totalReplaced} files to use calendar_datetime.`);
