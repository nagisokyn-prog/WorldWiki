// Pure domain entity without framework imports
pub struct Chapter {
    pub id: String,
    pub title: String,
    pub word_count: usize,
}

impl Chapter {
    pub fn new(id: String, title: String) -> Self {
        Self {
            id,
            title,
            word_count: 0,
        }
    }
}
