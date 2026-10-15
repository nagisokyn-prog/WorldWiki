#![no_std]

extern crate alloc;

pub mod age;
pub mod astronomy;
pub mod conversion;
pub mod convergents;
pub mod dial;
pub mod eras;
pub mod holidays;
pub mod intervals;
pub mod leap;
pub mod scalar;
pub mod seasons;
pub mod types;
pub mod weekdays;
pub mod year_finder;

#[cfg(any(kani, feature = "kani"))]
pub mod verify;

pub use age::*;
pub use astronomy::*;
pub use conversion::*;
pub use convergents::*;
pub use dial::*;

pub use eras::*;
pub use holidays::*;
pub use intervals::*;
pub use leap::*;
pub use scalar::*;
pub use seasons::*;
pub use types::*;
pub use weekdays::*;
pub use year_finder::*;
