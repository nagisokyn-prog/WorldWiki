use cerberus_domain::{DirNode, FileMetricsNode, TreeItemNode};
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

pub fn build_tree_hierarchy(base_dir: &Path, files: &[FileMetricsNode]) -> Vec<TreeItemNode> {
    let mut dir_files: BTreeMap<PathBuf, Vec<FileMetricsNode>> = BTreeMap::new();
    let mut all_dirs: BTreeSet<PathBuf> = BTreeSet::new();

    for file in files {
        let parent = file.path.parent().unwrap_or(base_dir).to_path_buf();
        dir_files.entry(parent.clone()).or_default().push(file.clone());

        let mut curr = parent.as_path();
        while curr != base_dir && curr.starts_with(base_dir) {
            all_dirs.insert(curr.to_path_buf());
            if let Some(p) = curr.parent() {
                curr = p;
            } else {
                break;
            }
        }
    }

    build_dir_nodes(base_dir, &dir_files, &all_dirs)
}

fn build_dir_nodes(
    current: &Path,
    dir_files: &BTreeMap<PathBuf, Vec<FileMetricsNode>>,
    all_dirs: &BTreeSet<PathBuf>,
) -> Vec<TreeItemNode> {
    let mut children = Vec::new();

    for d in all_dirs {
        if d.parent() == Some(current) {
            let dir_name = match d.file_name() {
                Some(s) => s.to_string_lossy().to_string(),
                None => String::new(),
            };
            let sub_children = build_dir_nodes(d, dir_files, all_dirs);
            children.push(TreeItemNode::Dir(DirNode {
                name: dir_name,
                path: d.clone(),
                children: sub_children,
            }));
        }
    }

    if let Some(files_in_dir) = dir_files.get(current) {
        for f in files_in_dir {
            children.push(TreeItemNode::File(f.clone()));
        }
    }

    children
}
