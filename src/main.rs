use std::env::args;
use std::fmt::format;
use std::io::Read;
use std::{fs, io};

fn main() {
    let stdin = io::stdin();
    let mut iter = args();
    iter.next().unwrap();
    let file = iter.next().expect("No file was given");
    let mut stream = fs::File::open(file).expect("Failed to open file");
    let mut content = String::new();
    stream
        .read_to_string(&mut content)
        .expect("Failed to read file");
    for (i, c) in content.chars().enumerate() {
        let code = c as i32;
        println!("{}, {}, {}", i, c, code);
    }
    loop {
        let mut input = String::new();
        stdin.read_line(&mut input).expect("Failed to read line");
        // table
        // insert
        // get
        // set
        // TODO: convert js one to rust and then make it executable
    }
}
