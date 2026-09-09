# Data Dictionary

The canonical schema is `packages/database/prisma/schema.prisma`. Each model documents tenant ownership, keys, uniqueness, lifecycle, sensitive fields, and indexes. Encrypted values are never used for equality; normalized hashes support duplicate detection. Cross-wedding relationships are validated transactionally and tested.
