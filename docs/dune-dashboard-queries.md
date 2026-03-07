# Helixa Dune Dashboard — SQL Queries

Create these as queries on dune.com, then add to a dashboard titled **"Helixa Protocol"**.

## Contract Addresses (Base)
- HelixaV2: `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`
- CredOracle: `0xD77354Aebea97C65e7d4a605f91737616FFA752f`
- CredStakingV2: `0x0adb95311B9B6007cA045bD05d0FEecfa2d8C4b0`
- $CRED: `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3`

## Event Signatures (keccak256)
- Transfer: `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`
- AgentRegistered: `0x33fbfc1a38a84cdbcb4f7447934790fa9fbde65c43076c8bbeb0f8078a2310f3`
- Staked: `0xdf5abd5a7abf883f38bef4c5ca75aea9e8b5ffa581b8b234a3e91da141e434d0`
- Unstaked: `0xffdaf13b1d96bfc2213355f353f84c19493e0681eb0df26f83d862acd266750a`
- CredUpdated: `0xf0c4b913e45573bf86658c741042bff212f18ed72304d9b08b7f22e4c4b3ad4c`

---

## 1. Total Agents Minted ⟶ Counter
```sql
SELECT COUNT(*) as total_agents
FROM base.logs
WHERE contract_address = 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60
  AND topic0 = 0x33fbfc1a38a84cdbcb4f7447934790fa9fbde65c43076c8bbeb0f8078a2310f3
```

## 2. Daily Mints ⟶ Bar Chart
```sql
SELECT
  DATE_TRUNC('day', block_time) as day,
  COUNT(*) as mints
FROM base.logs
WHERE contract_address = 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60
  AND topic0 = 0x33fbfc1a38a84cdbcb4f7447934790fa9fbde65c43076c8bbeb0f8078a2310f3
GROUP BY 1
ORDER BY 1
```

## 3. Cumulative Mints ⟶ Area Chart
```sql
SELECT
  day,
  SUM(mints) OVER (ORDER BY day) as cumulative_mints
FROM (
  SELECT
    DATE_TRUNC('day', block_time) as day,
    COUNT(*) as mints
  FROM base.logs
  WHERE contract_address = 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60
    AND topic0 = 0x33fbfc1a38a84cdbcb4f7447934790fa9fbde65c43076c8bbeb0f8078a2310f3
  GROUP BY 1
)
ORDER BY 1
```

## 4. Unique Minters ⟶ Counter
```sql
SELECT COUNT(DISTINCT topic2) as unique_minters
FROM base.logs
WHERE contract_address = 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60
  AND topic0 = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
  AND topic1 = 0x0000000000000000000000000000000000000000000000000000000000000000
```

## 5. Top Minters ⟶ Table
```sql
SELECT
  topic2 as minter,
  COUNT(*) as agents_minted
FROM base.logs
WHERE contract_address = 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60
  AND topic0 = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
  AND topic1 = 0x0000000000000000000000000000000000000000000000000000000000000000
GROUP BY 1
ORDER BY 2 DESC
LIMIT 25
```

## 6. Mint Revenue (ETH) ⟶ Counter + Line
```sql
-- Total revenue
SELECT
  SUM(value) / 1e18 as total_eth_revenue
FROM base.transactions
WHERE "to" = 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60
  AND value > 0
  AND success = true
```

```sql
-- Daily revenue
SELECT
  DATE_TRUNC('day', block_time) as day,
  SUM(value) / 1e18 as eth_revenue,
  COUNT(*) as paid_mints
FROM base.transactions
WHERE "to" = 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60
  AND value > 0
  AND success = true
GROUP BY 1
ORDER BY 1
```

## 7. $CRED Transfer Volume ⟶ Bar Chart
```sql
SELECT
  DATE_TRUNC('day', block_time) as day,
  SUM(bytearray_to_uint256(data)) / 1e18 as volume_cred,
  COUNT(*) as transfers
FROM base.logs
WHERE contract_address = 0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3
  AND topic0 = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
GROUP BY 1
ORDER BY 1
```

## 8. Staking Activity ⟶ Bar Chart
```sql
SELECT
  DATE_TRUNC('day', block_time) as day,
  COUNT(*) as stake_events
FROM base.logs
WHERE contract_address = 0x0adb95311B9B6007cA045bD05d0FEecfa2d8C4b0
  AND topic0 = 0xdf5abd5a7abf883f38bef4c5ca75aea9e8b5ffa581b8b234a3e91da141e434d0
GROUP BY 1
ORDER BY 1
```

## 9. CredOracle Updates ⟶ Line Chart
```sql
SELECT
  DATE_TRUNC('day', block_time) as day,
  COUNT(*) as score_updates
FROM base.logs
WHERE contract_address = 0xD77354Aebea97C65e7d4a605f91737616FFA752f
  AND topic0 = 0xf0c4b913e45573bf86658c741042bff212f18ed72304d9b08b7f22e4c4b3ad4c
GROUP BY 1
ORDER BY 1
```

## 10. Protocol Overview ⟶ Counters Row
```sql
SELECT
  (SELECT COUNT(*) FROM base.logs
   WHERE contract_address = 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60
     AND topic0 = 0x33fbfc1a38a84cdbcb4f7447934790fa9fbde65c43076c8bbeb0f8078a2310f3
  ) as agents_minted,
  (SELECT COUNT(DISTINCT topic2) FROM base.logs
   WHERE contract_address = 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60
     AND topic0 = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
     AND topic1 = 0x0000000000000000000000000000000000000000000000000000000000000000
  ) as unique_minters,
  (SELECT SUM(value) / 1e18 FROM base.transactions
   WHERE "to" = 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60
     AND value > 0 AND success = true
  ) as eth_revenue,
  (SELECT COUNT(*) FROM base.logs
   WHERE contract_address = 0x0adb95311B9B6007cA045bD05d0FEecfa2d8C4b0
     AND topic0 = 0xdf5abd5a7abf883f38bef4c5ca75aea9e8b5ffa581b8b234a3e91da141e434d0
  ) as total_stakes
```

---

## Dashboard Layout

**Row 1 — Key Metrics (Counters)**
| Total Agents | Unique Minters | ETH Revenue | Total Stakes |

**Row 2 — Growth**
| Cumulative Mints (area) | Daily Mints (bar) |

**Row 3 — Economy**
| $CRED Volume (bar) | Staking Activity (bar) |

**Row 4 — Infrastructure**
| CredOracle Updates (line) | Mint Revenue (line) |

**Row 5 — Tables**
| Top Minters |
