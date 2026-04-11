// ZKDrop - Privacy-first decentralized file sharing on Aleo
// Smart Contract: zkdrop_zkdrop_0001.aleo
//
// Leo 4.0.0 syntax
// Key rules:
// - Records: owner: address MUST be first field
// - self.caller MUST be bound before final {} block
// - Mapping::get/set MUST be inside final {} block
// - block.height inside final {} block
// - Final must be LAST element in tuple return
// - Array literals: type suffixes on each element, e.g. name[0u8], 1u64, 0u8
//
// Hash strategy:
// file_id = sha256(ipfs_bytes) passed from frontend as a field literal.
// access_key = sha256(file_id_hex + address) passed from frontend as a field.
// Both frontend (WebCrypto SHA-256) and contract use SHA-256 → no mismatch.
//
// View functions: read mappings via Aleo RPC API directly.

program zkdrop_zkdrop_0001.aleo {

    // ─────────────────────────────────────────────────────────────
    // Records (Private State — only owner can read)
    // ─────────────────────────────────────────────────────────────

    record FileRecord {
        owner: address,
        file_id: field,
        name: [u8; 64],
        ipfs_hash: [u8; 64],
        price: u64,
        access_count: u64,
        created_at: u32,    // block height at upload (kept for record compatibility)
    }

    record AccessRecord {
        owner: address,     // recipient of the access
        file_id: field,
        granted_at: u32,    // block height at access grant
        expires_at: u32,    // block height at expiry (0 = never expires)
    }

    // ─────────────────────────────────────────────────────────────
    // Mappings (Public State)
    //
    // Privacy tradeoff (documented):
    // - file_owners / file_prices / file_names are PUBLIC for
    //   buyer discovery. True privacy requires ZK commitments.
    // - access_grants uses sha256(file_id + address) as key —
    //   no one can enumerate who has access.
    // ─────────────────────────────────────────────────────────────

    mapping file_counter: u8 => u64;
    mapping file_owners: field => address;
    mapping file_prices: field => u64;
    mapping file_counters: field => u64;
    mapping file_names: field => [u8; 32];
    mapping file_created_at: field => u32;
    mapping access_grants: field => u64;   // key = sha256(file_id + address)
    mapping access_granted_at: field => u32;

    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────

    @noupgrade
    constructor() {}

    // ─────────────────────────────────────────────────────────────
    // upload_file — register file, return FileRecord to owner
    //
    // file_id is passed as a pre-computed field from the frontend.
    // Frontend computes: sha256(ipfs_bytes) → hex → "0x...field"
    // Contract stores it directly. This guarantees SHA-256 matches
    // between frontend and chain (RC1 fix).
    // ─────────────────────────────────────────────────────────────

    fn upload_file(
        name: [u8; 64],
        ipfs_hash: [u8; 64],
        price: u64,
        file_id: field,
    ) -> (FileRecord, Final) {
        let caller: address = self.caller;

        // Build 32-byte name prefix for public discovery mapping.
        let name_short: [u8; 32] = [
            name[0u8],  name[1u8],  name[2u8],  name[3u8],
            name[4u8],  name[5u8],  name[6u8],  name[7u8],
            name[8u8],  name[9u8],  name[10u8], name[11u8],
            name[12u8], name[13u8], name[14u8], name[15u8],
            name[16u8], name[17u8], name[18u8], name[19u8],
            name[20u8], name[21u8], name[22u8], name[23u8],
            name[24u8], name[25u8], name[26u8], name[27u8],
            name[28u8], name[29u8], name[30u8], name[31u8],
        ];

        return (
            FileRecord {
                owner: caller,
                file_id,
                name,
                ipfs_hash,
                price,
                access_count: 0u64,
                created_at: block.height,
            },
            final {
                // Increment and persist total file counter
                let c: u64 = Mapping::get_or_use(file_counter, 0u8, 0u64);
                Mapping::set(file_counter, 0u8, c + 1u64);

                // Store public metadata for buyer discovery
                Mapping::set(file_owners, file_id, caller);
                Mapping::set(file_prices, file_id, price);
                Mapping::set(file_counters, file_id, 0u64);
                Mapping::set(file_names, file_id, name_short);

                // Store creation block height (M1 fix)
                let bh: u32 = block.height;
                Mapping::set(file_created_at, file_id, bh);
            }
        );
    }

    // ─────────────────────────────────────────────────────────────
    // request_access — any user requests access to a file
    //
    // access_key is passed as a pre-computed field from the frontend.
    // Frontend computes: sha256(file_id_hex + address) → hex → "0x...field"
    // Contract stores it. Per-user key = sha256(file_id + address).
    // This fixes RH2: access key now matches between frontend and chain.
    //
    // NOTE (RH3): Payment is done SEPARATELY via credits.aleo/transfer_public.
    // This function records access intent. For trustless payment verification,
    // an atomic multi-program call or escrow mapping would be needed (future).
    // ─────────────────────────────────────────────────────────────

    fn request_access(
        file_id: field,
        access_key: field,
    ) -> (AccessRecord, Final) {
        let caller: address = self.caller;

        return (
            AccessRecord {
                owner: caller,
                file_id,
                granted_at: block.height,
                expires_at: 0u32,  // 0 = never expires
            },
            final {
                // Increment per-file access counter
                let current: u64 = Mapping::get_or_use(file_counters, file_id, 0u64);
                Mapping::set(file_counters, file_id, current + 1u64);

                // Grant access for this specific user (per-user hashed key)
                Mapping::set(access_grants, access_key, 1u64);

                // Store access grant block height (M1 fix)
                let bh: u32 = block.height;
                Mapping::set(access_granted_at, access_key, bh);
            }
        );
    }

    // ─────────────────────────────────────────────────────────────
    // revoke_access — owner revokes a specific user's access
    //
    // access_key is passed from frontend (same sha256 computation).
    // Owner proves ownership via FileRecord (H8 fix).
    // ─────────────────────────────────────────────────────────────

    fn revoke_access(
        file_id: field,
        access_key: field,
        file_record: FileRecord,
    ) -> Final {
        // Verify caller is the file owner using the private record (H8 fix)
        assert_eq(file_record.owner, self.caller);
        assert_eq(file_record.file_id, file_id);

        return final {
            Mapping::set(access_grants, access_key, 0u64);
        };
    }

    // ─────────────────────────────────────────────────────────────
    // update_price — owner updates the file price
    // ─────────────────────────────────────────────────────────────

    fn update_price(
        file_id: field,
        new_price: u64,
        file_record: FileRecord,
    ) -> (FileRecord, Final) {
        assert_eq(file_record.owner, self.caller);
        assert_eq(file_record.file_id, file_id);

        return (
            FileRecord {
                owner: file_record.owner,
                file_id: file_record.file_id,
                name: file_record.name,
                ipfs_hash: file_record.ipfs_hash,
                price: new_price,
                access_count: file_record.access_count,
                created_at: file_record.created_at,
            },
            final {
                Mapping::set(file_prices, file_id, new_price);
            }
        );
    }
}
