================================================================================
PRISMA PLAIN GUIDE — sahayi-enterprise
================================================================================

This file explains Prisma in this repository: datatypes, where the schema lives,
how to change it safely, examples with MySQL size limits, and relationship
mappings (1:1, 1:n, n:n).

Project facts (current state):

- Schema file: prisma/schema.prisma
- Config file: prisma.config.ts (points schema + migrations path)
- Database: MySQL / MariaDB (provider = "mysql")
- Connection URL: DATABASE_URL in .env
- Generated client: generated/prisma (imported from libs/db/src/prisma.ts)
- Existing model: User (one table today)
- Migrations path: prisma/migrations (created when you run first migrate)

================================================================================

1. # ALL DATATYPES — EXISTING TABLE vs NEW TABLE

WHAT
In Prisma, a "model" becomes a database table. Each field on the model becomes
a column with a Prisma scalar type (String, Int, etc.). Optional native MySQL
types and lengths are set with @db.\* attributes.

WHY
Prisma types are database-agnostic in the schema; @db.\* maps them to exact
MySQL column types and sizes so you control storage, indexes, and limits.

WHEN

- Use the EXISTING table (model) when you only add/change columns on User.
- Use a NEW table (new model) when you store a different entity (Post, Order).

HOW — EXISTING TABLE (User today)
Edit the model User { ... } block in prisma/schema.prisma.

Current columns:
id String @id @default(uuid()) -> PK, VARCHAR (uuid string)
email String @unique -> unique index
password String -> text
role String -> text
createdAt DateTime @default(now()) -> timestamp

HOW — NEW TABLE
Add a new model block in the same file:

    model Post {
      id        String   @id @default(uuid())
      title     String   @db.VarChar(200)
      userId    String
      user      User     @relation(fields: [userId], references: [id])
      createdAt DateTime @default(now())
    }

Then add the reverse side on User:

    model User {
      ...
      posts Post[]
    }

---

## Prisma scalar types (all) — MySQL mapping and typical limits

| Type                         | Prisma example                  | MySQL (typical)    | Size / limits       |
| ---------------------------- | ------------------------------- | ------------------ | ------------------- |
| String                       | name String                     | VARCHAR(191)       | Default 191 chars   |
| name String @db.VarChar(50)  | VARCHAR(50)                     | Max 65,535 bytes\* |
| code String @db.Char(10)     | CHAR(10)                        | Fixed 10 chars     |
| body String @db.Text         | TEXT                            | ~64 KB             |
| body String @db.MediumText   | MEDIUMTEXT                      | ~16 MB             |
| body String @db.LongText     | LONGTEXT                        | ~4 GB              |
| Boolean                      | active Boolean @default(true)   | TINYINT(1)         | 0 or 1              |
| Int                          | count Int                       | INT                | -2^31 .. 2^31-1     |
| count Int @db.SmallInt       | SMALLINT                        | -32768 .. 32767    |
| count Int @db.MediumInt      | MEDIUMINT                       | ~24-bit            |
| count Int @db.TinyInt        | TINYINT                         | -128 .. 127        |
| BigInt                       | views BigInt                    | BIGINT             | 64-bit integer      |
| Float                        | score Float                     | DOUBLE             | floating point      |
| Decimal                      | price Decimal @db.Decimal(10,2) | DECIMAL(10,2)      | exact numeric       |
| DateTime                     | at DateTime @default(now())     | DATETIME(3)        | ms precision        |
| at DateTime @db.Date         | DATE                            | date only          |
| at DateTime @db.Time         | TIME                            | time only          |
| at DateTime @db.Timestamp(0) | TIMESTAMP                       | auto UTC rules     |
| Json                         | meta Json                       | JSON               | JSON document       |
| Bytes                        | file Bytes                      | LONGBLOB           | binary data         |
| Enum                         | role Role                       | ENUM('A','B')      | fixed set of values |

- VARCHAR max length in MySQL is 65,535 bytes, but row size and charset (utf8mb4
  uses up to 4 bytes per character) reduce practical limits. Indexed String fields
  often use 191 in Prisma/MySQL to stay under index byte limits.

Optional vs required:

- field String -> required (NOT NULL)
- field String? -> optional (NULL allowed)

Lists (relations only, not scalar columns):

- posts Post[] -> one user has many posts (1:n), not a column type

---

## Field attributes you will use often

@id Primary key
@unique Unique constraint (one value per table)
@default(...) Value if not provided on insert
@updatedAt Auto-set on every update (DateTime fields)
@map("column_name") DB column name differs from field name
@@map("table_name") DB table name differs from model name
@@index([a, b]) Non-unique index
@@unique([a, b]) Composite unique
@relation(...) Foreign key / link between models
@db.\* Native MySQL type and size

================================================================================ 2. WHERE TO CREATE A NEW SCHEMA (MODEL / TABLE)
================================================================================

WHAT
All models for this app live in ONE schema file unless you later split files
(advanced). New tables = new model blocks in that file.

WHERE (this repo)
File: prisma/schema.prisma
Config: prisma.config.ts already sets:
schema: "prisma/schema.prisma"
migrations.path: "prisma/migrations"

WHY
Single schema keeps one source of truth. prisma.config.ts tells Prisma CLI
where to read schema and where to write migration SQL.

WHEN

- New feature needs its own entity (orders, sessions, devices).
- You outgrow one model and need relations.

HOW (steps)

1. Open prisma/schema.prisma
2. Add a new model { ... } block (see section 4 for full example)
3. Add @relation fields if it links to User or another model
4. Run migration workflow (section 3)
5. Run: npx prisma generate
6. Use generated client from generated/prisma in your services/repos

Do NOT create tables only in MySQL Workbench without updating schema.prisma —
Prisma will drift from the database and the client types will be wrong.

================================================================================ 3. HOW TO UPDATE THE SCHEMA (ADD / REMOVE / CHANGE)
================================================================================

WHAT
Changing schema.prisma describes intent; migrations (or db push) apply it to
MySQL. generate refreshes TypeScript types in generated/prisma.

WHY

- migrate dev: versioned SQL history for teams and production
- db push: quick prototype without migration files (avoid for production)
- generate: required after every schema change so code matches DB

WHEN to use which
| Situation | Command |
|------------------------------------|----------------------------------|
| Local dev, tracked migrations | npx prisma migrate dev --name X |
| Production / CI deploy | npx prisma migrate deploy |
| Throwaway local experiment | npx prisma db push |
| After any schema change | npx prisma generate |
| Inspect DB vs schema | npx prisma migrate status |
| Reset local DB (destructive) | npx prisma migrate reset |

HOW — ADD a column to existing User

1. Edit prisma/schema.prisma (e.g. add phone String? @db.VarChar(20))
2. npx prisma migrate dev --name add_user_phone
3. npx prisma generate
4. Update repository/service code to use new field

HOW — REMOVE a column

1. Remove field from model in schema.prisma
2. npx prisma migrate dev --name remove_user_phone
   WARNING: migrate dev will DROP the column and delete data in that column.
3. npx prisma generate
4. Remove field from application code

HOW — ADD a new table (model)

1. Add model Post { ... } and relations
2. npx prisma migrate dev --name add_post_table
3. npx prisma generate

HOW — REMOVE a whole table

1. Delete model block and remove relation fields on other models
2. npx prisma migrate dev --name remove_post_table
   WARNING: drops table and all its rows.
3. npx prisma generate

HOW — RENAME (safe pattern)
Prefer @map / @@map to rename in DB without breaking Prisma model names, or use
a multi-step migration (add new column, copy data, drop old) for zero-downtime.

Environment
Ensure .env has DATABASE_URL before any command, e.g.:
DATABASE_URL="mysql://user:pass@localhost:3306/sahayi_db"

First-time setup (no migrations folder yet)
npx prisma migrate dev --name init

================================================================================ 4. FULL EXAMPLE — ALL DATATYPES + LIMITS + RELATIONS
================================================================================

Below is a REFERENCE model (not in your schema today). Copy pieces into
schema.prisma as needed, then migrate.

---------- 4a. Enums ----------

enum UserRole {
ADMIN
USER
GUEST
}

enum OrderStatus {
PENDING
PAID
CANCELLED
}

---------- 4b. Example "kitchen sink" model (every scalar type) ----------

model DataTypeSample {
// String variants (character limits)
id String @id @default(uuid()) @db.VarChar(36)
shortLabel String @db.VarChar(50) // max 50 chars
fixedCode String @db.Char(8) // always 8 chars (padded)
email String @unique @db.VarChar(255)
notes String? @db.Text // optional, ~64 KB
longNotes String? @db.MediumText
hugeNotes String? @db.LongText

// Numbers
quantity Int @default(0) // INT
smallCount Int @db.SmallInt
pageViews BigInt @default(0) // BIGINT
rating Float? // DOUBLE
unitPrice Decimal @db.Decimal(12, 2) // 12 digits, 2 decimal places
taxRate Decimal @db.Decimal(5, 4)

// Boolean & time
isActive Boolean @default(true)
bornOn DateTime @db.Date // date only
opensAt DateTime @db.Time(0) // time only
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

// Json & binary
metadata Json?
avatar Bytes?

// Enum
role UserRole @default(USER)

@@map("data_type_samples")
}

---------- 4c. Existing User extended + new tables + all relation types ----------

model User {
id String @id @default(uuid())
email String @unique @db.VarChar(255)
password String @db.VarChar(255) // store hash, not plain text
role UserRole @default(USER) // prefer enum over free String
phone String? @db.VarChar(20)
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

// 1:1 — one user has at most one profile
profile Profile?

// 1:n — one user has many posts
posts Post[]

// n:n — many users, many tags (implicit join table)
tags Tag[]

// n:n — explicit join table with extra columns
groups UserGroup[]
}

// 1:1 other side — profile belongs to one user
model Profile {
id String @id @default(uuid())
bio String? @db.VarChar(500)
userId String @unique
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// 1:n child — many posts per user
model Post {
id String @id @default(uuid())
title String @db.VarChar(200)
body String @db.Text
userId String
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
createdAt DateTime @default(now())

@@index([userId])
}

// n:n implicit — Prisma creates \_TagToUser join table
model Tag {
id String @id @default(uuid())
name String @unique @db.VarChar(80)
users User[]
}

// n:n explicit — join model when you need enrolledAt, role, etc.
model Group {
id String @id @default(uuid())
name String @db.VarChar(100)
members UserGroup[]
}

model UserGroup {
userId String
groupId String
role String @db.VarChar(30) // e.g. "owner", "member"
joinedAt DateTime @default(now())
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)

@@id([userId, groupId])
}

================================================================================ 5. RELATIONSHIP MAPPINGS — WHAT, WHY, WHEN, HOW
================================================================================

1:1 (one-to-one)
WHAT: One User <-> one Profile.
WHY: Split optional or large data without bloating the main user row.
WHEN: Profile, settings, KYC details separate from login credentials.
HOW: Foreign key on the "owned" side with @unique (userId String @unique).

1:n (one-to-many)
WHAT: One User -> many Post.
WHY: Parent/child ownership (author has many articles).
WHEN: Any "has many" business rule.
HOW: userId on child; user Post[] on parent; @relation(fields, references).

n:n (many-to-many)
WHAT: Many User <-> many Tag.
WHY: Tags, roles, categories shared across entities.
WHEN: Neither side exclusively owns the other.
HOW (implicit): Tag[] on User and User[] on Tag — Prisma manages join table.
HOW (explicit): UserGroup model with @@id([userId, groupId]) when join row
needs extra fields (role, joinedAt).

onDelete behavior (WHY/WHEN)
Cascade — delete children when parent deleted (posts with user)
SetNull — optional FK set to null (only if field is String?)
Restrict — prevent delete if children exist

================================================================================ 6. CHARACTER & VALIDATION LIMITS — PRACTICAL RULES
================================================================================

WHAT
Limits exist at three layers: Prisma schema (@db.\*), database (MySQL), and
application validation (Zod in API).

WHY
Schema limits protect the DB; API validation protects business rules and UX.

WHEN

- Always set @db.VarChar(n) for emails, names, codes with known max length.
- Use Text / MediumText / LongText for unbounded user content.
- Use Decimal for money; never Float for currency.

HOW (recommended max lengths for this project)
email VarChar(255) — RFC practical max
password hash VarChar(255) — bcrypt/argon hashes fit
name/title VarChar(100-200)
phone VarChar(20)
country code Char(2) or VarChar(3)
uuid id VarChar(36)
slug VarChar(80) + @unique
description Text or MediumText
JSON payload Json type (not String)

Application layer (auth-service example pattern):
Validate with Zod before Prisma:
z.string().email().max(255)
z.string().min(8).max(72) // password input, then hash before store

================================================================================ 7. WORKFLOW CHEAT SHEET (WHAT -> COMMAND)
================================================================================

Change schema only (no DB yet) -> edit prisma/schema.prisma
Apply to local MySQL + migration -> npx prisma migrate dev --name describe_change
Refresh TypeScript client -> npx prisma generate
Quick sync without migration file -> npx prisma db push
Deploy migrations to server -> npx prisma migrate deploy
Open visual browser -> npx prisma studio

Import in code (this repo):
import { prisma } from '<path>/libs/db/src/prisma';
await prisma.user.findUnique({ where: { email: 'a@b.com' } });

================================================================================ 8. CURRENT SCHEMA vs DOCUMENTED EXAMPLES
================================================================================

IN PRODUCTION SCHEMA TODAY (prisma/schema.prisma):

- Model: User only
- Types used: String, DateTime
- Relations: none (no 1:1, 1:n, n:n yet)
- role is plain String (examples above use enum UserRole — upgrade when ready)

DOCUMENTATION FILES:

- docs/prisma-datatype-and-mapping-documentation.md (mapping-focused)
- docs/prisma-plain-guide.txt (this file)

================================================================================
END OF GUIDE
================================================================================
