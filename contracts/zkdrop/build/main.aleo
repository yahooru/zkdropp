program zkdrop_zkdrop_0001.aleo;

record FileRecord:
    owner as address.private;
    file_id as field.private;
    name as [u8; 64u32].private;
    ipfs_hash as [u8; 64u32].private;
    price as u64.private;
    access_count as u64.private;

record AccessRecord:
    owner as address.private;
    file_id as field.private;

mapping file_counter:
    key as u8.public;
    value as u64.public;

mapping file_owners:
    key as field.public;
    value as address.public;

mapping file_prices:
    key as field.public;
    value as u64.public;

mapping file_counters:
    key as field.public;
    value as u64.public;

mapping file_names:
    key as field.public;
    value as [u8; 32u32].public;

mapping file_created_at:
    key as field.public;
    value as u32.public;

mapping access_grants:
    key as field.public;
    value as u64.public;

mapping access_granted_at:
    key as field.public;
    value as u32.public;

function upload_file:
    input r0 as [u8; 64u32].private;
    input r1 as [u8; 64u32].private;
    input r2 as u64.private;
    input r3 as field.private;
    cast r0[0u32] r0[1u32] r0[2u32] r0[3u32] r0[4u32] r0[5u32] r0[6u32] r0[7u32] r0[8u32] r0[9u32] r0[10u32] r0[11u32] r0[12u32] r0[13u32] r0[14u32] r0[15u32] r0[16u32] r0[17u32] r0[18u32] r0[19u32] r0[20u32] r0[21u32] r0[22u32] r0[23u32] r0[24u32] r0[25u32] r0[26u32] r0[27u32] r0[28u32] r0[29u32] r0[30u32] r0[31u32] into r4 as [u8; 32u32];
    cast self.caller r3 r0 r1 r2 0u64 into r5 as FileRecord.record;
    async upload_file r3 self.caller r2 r4 into r6;
    output r5 as FileRecord.record;
    output r6 as zkdrop_zkdrop_0001.aleo/upload_file.future;

finalize upload_file:
    input r0 as field.public;
    input r1 as address.public;
    input r2 as u64.public;
    input r3 as [u8; 32u32].public;
    get.or_use file_counter[0u8] 0u64 into r4;
    add r4 1u64 into r5;
    set r5 into file_counter[0u8];
    set r1 into file_owners[r0];
    set r2 into file_prices[r0];
    set 0u64 into file_counters[r0];
    set r3 into file_names[r0];
    set block.height into file_created_at[r0];

function request_access:
    input r0 as field.private;
    input r1 as field.private;
    cast self.caller r0 into r2 as AccessRecord.record;
    async request_access r0 r1 into r3;
    output r2 as AccessRecord.record;
    output r3 as zkdrop_zkdrop_0001.aleo/request_access.future;

finalize request_access:
    input r0 as field.public;
    input r1 as field.public;
    get.or_use file_counters[r0] 0u64 into r2;
    add r2 1u64 into r3;
    set r3 into file_counters[r0];
    set 1u64 into access_grants[r1];
    set block.height into access_granted_at[r1];

function revoke_access:
    input r0 as field.private;
    input r1 as field.private;
    input r2 as FileRecord.record;
    assert.eq r2.owner self.caller;
    assert.eq r2.file_id r0;
    async revoke_access r1 into r3;
    output r3 as zkdrop_zkdrop_0001.aleo/revoke_access.future;

finalize revoke_access:
    input r0 as field.public;
    set 0u64 into access_grants[r0];

function update_price:
    input r0 as field.private;
    input r1 as u64.private;
    input r2 as FileRecord.record;
    assert.eq r2.owner self.caller;
    assert.eq r2.file_id r0;
    cast r2.owner r2.file_id r2.name r2.ipfs_hash r1 r2.access_count into r3 as FileRecord.record;
    async update_price r0 r1 into r4;
    output r3 as FileRecord.record;
    output r4 as zkdrop_zkdrop_0001.aleo/update_price.future;

finalize update_price:
    input r0 as field.public;
    input r1 as u64.public;
    set r1 into file_prices[r0];

constructor:
    assert.eq edition 0u16;
