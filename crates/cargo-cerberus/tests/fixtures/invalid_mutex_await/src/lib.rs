use std::sync::Mutex;

pub async fn bad_async_fn(m: &Mutex<u32>) {
    let guard = m.lock().unwrap();
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    let _ = *guard;
}
