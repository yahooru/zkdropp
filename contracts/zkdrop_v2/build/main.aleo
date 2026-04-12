program zkdrop_v4_0002.aleo;

record FileRecord:
    owner as address.private;
    file_id as field.private;
    name as [u8; 64u32].private;
    ipfs_hash as [u8; 64u32].private;
    price as u64.private;
    access_count as u64.private;
    created_at as u64.private;
    file_key as u64.private;

record AccessRecord:
    owner as address.private;
    file_id as field.private;
    ipfs_hash as [u8; 64u32].private;
    file_name as [u8; 32u32].private;
    granted_at as u64.private;
    expires_at as u64.private;
    access_key as u64.private;

mapping file_counter:
    key as u64.public;
    value as u64.public;

mapping file_owners:
    key as u64.public;
    value as address.public;

mapping file_prices:
    key as u64.public;
    value as u64.public;

mapping file_counters:
    key as u64.public;
    value as u64.public;

mapping file_names:
    key as u64.public;
    value as [u8; 32u32].public;

mapping file_created_at:
    key as u64.public;
    value as u32.public;

mapping file_unix_ts:
    key as u64.public;
    value as u64.public;

mapping access_grants:
    key as u64.public;
    value as u64.public;

mapping access_granted_at:
    key as u64.public;
    value as u32.public;

function upload_file:
    input r0 as [u8; 64u32].private;
    input r1 as [u8; 64u32].private;
    input r2 as u64.private;
    input r3 as u64.private;
    input r4 as field.private;
    input r5 as u64.private;
    cast self.caller r4 r0 r1 r2 0u64 r5 r3 into r6 as FileRecord.record;
    async upload_file r0 r3 self.caller r2 r5 into r7;
    output r6 as FileRecord.record;
    output r7 as zkdrop_v4_0002.aleo/upload_file.future;

finalize upload_file:
    input r0 as [u8; 64u32].public;
    input r1 as u64.public;
    input r2 as address.public;
    input r3 as u64.public;
    input r4 as u64.public;
    cast r0[0u32] r0[1u32] r0[2u32] r0[3u32] r0[4u32] r0[5u32] r0[6u32] r0[7u32] r0[8u32] r0[9u32] r0[10u32] r0[11u32] r0[12u32] r0[13u32] r0[14u32] r0[15u32] r0[16u32] r0[17u32] r0[18u32] r0[19u32] r0[20u32] r0[21u32] r0[22u32] r0[23u32] r0[24u32] r0[25u32] r0[26u32] r0[27u32] r0[28u32] r0[29u32] r0[30u32] r0[31u32] into r5 as [u8; 32u32];
    get.or_use file_counter[0u64] 0u64 into r6;
    add r6 1u64 into r7;
    set r7 into file_counter[0u64];
    set r2 into file_owners[r1];
    set r3 into file_prices[r1];
    set 0u64 into file_counters[r1];
    set r5 into file_names[r1];
    set block.height into file_created_at[r1];
    set r4 into file_unix_ts[r1];

function request_access:
    input r0 as u64.private;
    input r1 as field.private;
    input r2 as [u8; 64u32].private;
    input r3 as [u8; 64u32].private;
    input r4 as u64.private;
    input r5 as u64.private;
    cast r3[0u32] r3[1u32] r3[2u32] r3[3u32] r3[4u32] r3[5u32] r3[6u32] r3[7u32] r3[8u32] r3[9u32] r3[10u32] r3[11u32] r3[12u32] r3[13u32] r3[14u32] r3[15u32] r3[16u32] r3[17u32] r3[18u32] r3[19u32] r3[20u32] r3[21u32] r3[22u32] r3[23u32] r3[24u32] r3[25u32] r3[26u32] r3[27u32] r3[28u32] r3[29u32] r3[30u32] r3[31u32] into r6 as [u8; 32u32];
    cast self.caller r1 r2 r6 r5 0u64 r4 into r7 as AccessRecord.record;
    async request_access r0 r4 into r8;
    output r7 as AccessRecord.record;
    output r8 as zkdrop_v4_0002.aleo/request_access.future;

finalize request_access:
    input r0 as u64.public;
    input r1 as u64.public;
    get.or_use file_counters[r0] 0u64 into r2;
    add r2 1u64 into r3;
    set r3 into file_counters[r0];
    set 1u64 into access_grants[r1];
    set block.height into access_granted_at[r1];

function revoke_access:
    input r0 as u64.private;
    input r1 as field.private;
    input r2 as u64.private;
    input r3 as FileRecord.record;
    assert.eq r3.owner self.caller;
    assert.eq r3.file_id r1;
    assert.eq r3.file_key r0;
    async revoke_access r2 into r4;
    output r4 as zkdrop_v4_0002.aleo/revoke_access.future;

finalize revoke_access:
    input r0 as u64.public;
    set 0u64 into access_grants[r0];

function update_price:
    input r0 as u64.private;
    input r1 as field.private;
    input r2 as u64.private;
    input r3 as FileRecord.record;
    assert.eq r3.owner self.caller;
    assert.eq r3.file_id r1;
    assert.eq r3.file_key r0;
    cast r3.owner r3.file_id r3.name r3.ipfs_hash r2 r3.access_count r3.created_at r3.file_key into r4 as FileRecord.record;
    async update_price r0 r2 into r5;
    output r4 as FileRecord.record;
    output r5 as zkdrop_v4_0002.aleo/update_price.future;

finalize update_price:
    input r0 as u64.public;
    input r1 as u64.public;
    set r1 into file_prices[r0];

function delete_file:
    input r0 as u64.private;
    input r1 as field.private;
    input r2 as FileRecord.record;
    assert.eq r2.owner self.caller;
    assert.eq r2.file_id r1;
    assert.eq r2.file_key r0;
    async delete_file r0 into r3;
    output r3 as zkdrop_v4_0002.aleo/delete_file.future;

finalize delete_file:
    input r0 as u64.public;
    set 0u64 into file_prices[r0];
    set 0u64 into file_counters[r0];

function update_name:
    input r0 as u64.private;
    input r1 as field.private;
    input r2 as [u8; 64u32].private;
    input r3 as FileRecord.record;
    assert.eq r3.owner self.caller;
    assert.eq r3.file_id r1;
    assert.eq r3.file_key r0;
    cast r3.owner r3.file_id r2 r3.ipfs_hash r3.price r3.access_count r3.created_at r3.file_key into r4 as FileRecord.record;
    async update_name r0 r2 into r5;
    output r4 as FileRecord.record;
    output r5 as zkdrop_v4_0002.aleo/update_name.future;

finalize update_name:
    input r0 as u64.public;
    input r1 as [u8; 64u32].public;
    cast r1[0u32] r1[1u32] r1[2u32] r1[3u32] r1[4u32] r1[5u32] r1[6u32] r1[7u32] r1[8u32] r1[9u32] r1[10u32] r1[11u32] r1[12u32] r1[13u32] r1[14u32] r1[15u32] r1[16u32] r1[17u32] r1[18u32] r1[19u32] r1[20u32] r1[21u32] r1[22u32] r1[23u32] r1[24u32] r1[25u32] r1[26u32] r1[27u32] r1[28u32] r1[29u32] r1[30u32] r1[31u32] into r2 as [u8; 32u32];
    set r2 into file_names[r0];

constructor:
    assert.eq edition 0u16;
