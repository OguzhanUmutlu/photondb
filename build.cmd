@echo off
cls
cargo build && "./target/debug/photondb.exe" %*