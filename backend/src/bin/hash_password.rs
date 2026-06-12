//! Утилита генерации argon2-хэша пароля менеджера.
//!
//! Пароль в открытом виде нигде не хранится — в ENV кладётся только его хэш
//! (`MANAGER_PASSWORD_HASH`). Этот бинарь печатает PHC-строку для заданного пароля.
//!
//! Использование:
//!   cargo run --bin hash_password -- 'СложныйПароль123'
//! затем результат -> в .env как MANAGER_PASSWORD_HASH=...

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};

fn main() {
    let password = std::env::args().nth(1).unwrap_or_else(|| {
        eprintln!("usage: hash_password <password>");
        std::process::exit(2);
    });

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .expect("argon2 hashing failed")
        .to_string();

    println!("{hash}");
}
