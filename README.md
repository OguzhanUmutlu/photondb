# Photon DB [![Tweet](https://img.shields.io/twitter/url/http/shields.io.svg?style=social)](https://twitter.com/intent/tweet?text=PhotonDB:%20A%20fast%20and%20compact%20database&hashtags=javascript,fast,node,sql,database,table,small,photon,compact&url=https://github.com/OguzhanUmutlu/photondb)

As fast as a photon, as small-sized as a photon.

## For further questions

My GitHub: [OguzhanUmutlu](https://github.com/OguzhanUmutlu)

My Discord: Oğuzhan#6561

## Why photon?

- ✨ Compared to other databases it is so small and compact! ✨
- ✨ It's so fast! ✨
- ✨ Supports multiple languages and executables for multiple operating systems! ✨

### Blazingly fast!

- Note: I know this is not related to sqlite, but I wanted to compare it to other famous databases.

|                                                                | select 1 row | select 100000 rows | insert 100000 row |
|----------------------------------------------------------------|--------------|--------------------|-------------------|
| photondb                                                       | 1x           | 1x                 | 1x                |
| [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) | 2.63x slower | 11.5x slower       | 17.7x slower      |

## Usage

### Importing

```js
const photon = require("photondb");
```

### Opening your file

```js
const db = photon("./myFile.pdb");
```

### Running a command

```js
db.query("CREATE TABLE helloWorld hi TEXT");
```

## Commands

### CREATE TABLE

#### Syntax: CREATE TABLE \<tableName> \<row-name> \<row-properties>, \<row-name> \<row-properties>, ...

- Tip: You can add `IF NOT EXISTS` after `CREATE TABLE` so it doesn't throw an error if the table already exists.
- Example: `CREATE TABLE IF NOT EXISTS workers id AUTOINCREMENT KEY, name, age NUMBER`

#### Examples:

- `CREATE TABLE workers id AUTOINCREMENT KEY, name, age NUMBER`
- `CREATE TABLE salaries id NUMBER, salary NUMBER`

#### Properties

- `text` - It means the row's type is a string/text. Text type will be selected if nothing is given.
- `number` - It means the row's type is a number. Can be negative or positive. Can be a floating number. If auto
  increment property is selected the type will be chosen as number.
- `auto-increment` - It means that whenever a new one is created its' value will be increased by one according to the
  last added one. If auto increment option is given there is no need for its type to be given. Alias: "autoincrement"
- `key` - It will make it a key which means you can't create two or more with the same value. Alias: "unique"
- `default=Something` - It will put that value to that column if it was not specified from the query. Alias: "def=Something"

### DELETE TABLE

#### Syntax: DELETE TABLE \<table>

#### Examples:

- `DELETE TABLE workers`
- `DELETE TABLE salaries`

### INSERT INTO

#### Syntax: INSERT INTO \<table> \<row-name> \<row-value>, \<row-name> \<row-value>, ...

#### Examples:

- `INSERT INTO workers name "Jack", age 22`
- `INSERT INTO salaries id 1, salary 15000`

### DELETE FROM

#### Syntax: DELETE FROM \<table> WHERE \<condition>

#### Examples:

- `DELETE FROM workers WHERE name "Jack"`
- `DELETE FROM salaries WHERE salary 15000`

### SELECT FROM

#### Syntax: SELECT FROM \<table> WHERE \<condition>

#### Examples:

- `SELECT FROM workers WHERE name "Jack", age 22`
- `SELECT FROM salaries WHERE salary 15000`

### UPDATE FROM

#### Syntax: UPDATE FROM \<table> WHERE \<condition> SET \<values>

#### Examples:

- `UPDATE FROM workers WHERE <condition> SET <values>`
- `UPDATE FROM salaries SET salary 30000`

# TODO

- Implementing to Rust
- Implementing to PHP