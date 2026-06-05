const fs = require('fs');
const path = require('path');

const files = [
  'character.json',
  'organization.json',
  'state.json',
  'ui_editor.json'
];

const dir = path.join(__dirname, 'src', 'struct', 'editor');

files.forEach(file => {
  const filePath = path.join(dir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace all occurrences of path or dataPath values that contain nested keys like "основное_ключ."
    // regex to match: "path": "основное_ключ.полное_имя"
    // We want to remove anything up to the last dot in the path string, BUT wait!
    // What if it's "внешность_ключ.базовая_ключ.пол"? It should just be "пол".
    // Or maybe just remove all `_ключ` and dots?
    // Actually, maybe we can just map the path to the last segment of the path!
    // Example: "внешность_ключ.базовая_ключ.пол" -> "пол"
    // Example: "основное_ключ.фото" -> "фото"
    // So regex: /"(dataPath|path|titleField|photoField|tagsField)":\s*"[^"]*\.([^".]+)"/g
    // Wait, if we do that, does it break anything?
    // Let's replace nested paths with their last segment.
    
    const regex = /"(dataPath|path|titleField|photoField|tagsField)":\s*"[^"]*\.([^".]+)"/g;
    content = content.replace(regex, '"$1": "$2"');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});
