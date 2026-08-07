-- xNFTs index — seed: the xNET and the genesis crew.
--
-- 97 deterministic wallets and the 512 xployees they already hold.
--
-- ---------------------------------------------------------------------------
-- WHY SIMULATED OWNERSHIP IS WRITTEN DOWN AT ALL
-- ---------------------------------------------------------------------------
-- `src/lib/network.ts` partitions the first 512 serials across 97 pseudo-wallets
-- by slicing a seeded permutation, and every xNET surface — the leaderboard, a
-- wallet sheet, the social directory, a trade offer naming somebody's units —
-- reads that partition. It is simulated and it stays simulated. What changes here
-- is only WHERE it lives.
--
-- It has to live here because the marketplace is about to become writable. A sale
-- moves `xployees.owner`; a trade offer names units a wallet must actually hold;
-- a listing has to be refused when the seller does not own what they are
-- advertising. Every one of those is a question about ownership, and a question
-- the database cannot answer is a question the database cannot enforce — the
-- server would be checking a claim against nothing, which is the same as not
-- checking it. So the partition is seeded, and from here on ownership has exactly
-- one home.
--
-- The 512 are marked `claim_kind = 'genesis'` in the reveal order rather than
-- 'minted', and the distinction is load-bearing: nobody burned for them, no
-- signature exists, and `public.mints` stays empty until a real transaction is
-- indexed. A reader asking "how many xployees have been minted" counts mints, not
-- owners.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES TO THE MINT POOL
-- ---------------------------------------------------------------------------
-- Claiming positions 0..511 is what stops a real mint being dealt a serial the
-- app is already rendering as somebody else's. `useHoldings.hire()` draws from
-- `serialForMint(HIRED_COUNT + n)` for exactly this reason; the dealer in
-- 20260806090500 gets the same behaviour for free by taking the lowest position
-- still in the pool, which after this file is 512.
--
-- Hire times come from `hireTimeFor(position)` — seeded on mint position, not on
-- the clock — so they are stable across machines and across re-runs of the
-- generator. Accrual is a pure function of (hired_at, now), so seeding the hire
-- time is what makes a book value computed in Postgres agree with one computed in
-- the browser.

-- The wallet rows first: `xployees.owner` is not a foreign key (a mint must never
-- fail because the buyer has no profile row), but the xNET wallets are known in
-- advance and a directory that can name them is better than one that cannot.
insert into public.wallets (address, handle) values
('2UGbkX5c2DmJ7LhDejmmC4z1DnLEn9DFZ2qZeZowPKYT','lanyardpusher'),
('2eaZ7LmLeeCYC7KD4BLBaDoM5gLFavZB9tBeP5H64Qse','candlebull'),
('36LyTsbPoxuafWNtBvyyJ44iEv6U5Gv1Q2q2pwdRRKZD','mstr_ape'),
('3WrSVq3wACYa3jkbJssjbTqR4C5Emz5JCXABYbJoqGLR','pivotbull52'),
('3cSYcZcYiB8HU7wMVAGRL7StsXt1gXgL3rdV4tsBG1Cd','wickdealer'),
('3ehHTBeunc2tsrUWY9e3RmGiQkpipNKy66c6h9qtTMJ7','fillape'),
('4BKvPBeTAnjSwpe7dpEXZHHNeNqfm6377x2ojmH2mRFE','overtimefund2'),
('4xuZhrBftGYDuMqRU6wGD9jsAKvQxTkdXuraaVQRffqy','v_holder'),
('5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','margingoblin62'),
('5mEW6FSZbfg9rV2j6Rgjo3Zr96nh1yzTKetyJBAJTWqR','capital_block'),
('7QJX18yNi2EPhfiT9hT295V2hqA3FQ46zGvm3nM1YGDy','stacker_fill'),
('7jZ8V9chpen3p5waHRAFz8wBEAe5enjqaPHSNmD8bNka','v_runner'),
('8qpBGG6atMZdNqgPNsKrUsydYM7nXqqoVSTdr6j3wy9n','tempprinter95'),
('97C6BD8uKT5UecxptgoWex9TwhPng2BpXgyEbE5mDNFy','mstr_printer'),
('9Bh3WaVoXyWK9sm3fq97JEXrSEQkkF9Xc4WCpM7hQ2Rr','ko_maxi'),
('9SnXcRSFTELMTvtkBU9boqD5ogpspVRkTF3ziGJQoGiM','yielddealer'),
('9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','printbot'),
('9k61cL8f1a8Z1phdMm4B9zGenzkwNouNJLrg8nzgCmTd','swivelmaxi96'),
('BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','filldegen'),
('BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','badgeape'),
('DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','overtimerunner'),
('DWcHzMf1wZ7V9qWfdLp8fiiG2b81AncqwbJUdvTmN1JY','xom_watcher'),
('EJP8o6tCeeLQmLzfJWur2MspXnm1X5PnsiakkNsnci1S','xom_goblin'),
('EUjBYtJvv35BoNFqnZjdteGDEVYHxr7Pr9KfweDJrpjo','sniper_severance'),
('EcUf8HcSwQwEYYzYNmJjRFXKw1d1nZFkWKRbviHASHkB','wireape'),
('F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','quotaflipper'),
('HYU5649zRdCYRzh2QC5B9ztiobiwUq3LYyHcWRY4e1Th','deskbot'),
('HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','deltaholder'),
('JXh99dYPCupQ4xMPkzFkFCUjWmfYv6RuKJy3NP42H4G1','shiftbull64'),
('JrH65VFWrnmYhyW5ptuiBquyb8RiMqvXuNBe2r3Qo4Bk','yieldwatcher'),
('Ki7sGTgPfaTWWVPhnmSQypacnQqfX36uYk81in7Mmnih','wickape74'),
('KvpN2fpaR9MKxZBeMPNVJ7hecZmPYnkQXEMiS8tGpmNS','mstr_stacker'),
('LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','tapewagie'),
('MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','wickfund88'),
('MQNvSuGofcVPe4hv5TcJHfMTt1qVv2owZ9zBTuf2XBVj','flipper_yield'),
('NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','mstr_capital'),
('NTP9d93FTGRFYKgxnYNiZyxN9xM8REjUVKh9kA15GVRz','overtimekeeper'),
('NYQbWWNBQWTR3T29TrDUaJy7MgjLVweCR6B5ouGVuhdj','sweeper_delta'),
('PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','timesheetdegen'),
('Q19hwFNs8PvmjCCdR2fMNjTNTAS5Ckno2xybmn2AQYjm','swivelsweeper'),
('QCRsqhZdAQPaRDXXd9vCTPZm4jBHVJ9opug33K58V9sK','fillwatcher'),
('QDLySA1CJmfeNEB7Bt2ScLYgfuLDm3jp4wGR16SNYyZX','v_grinder'),
('RHjPEJYcYyBiG2EnFeXYq7UMqnNXu3HAJhwzbYYmu5Cv','vaultrunner'),
('RUz37ya9EMZTCDjoVw4YbZpjb8q6YN7HiVrybpX3dzic','hon_chad'),
('RVDVQaj22zGAGpAEyJRrkkiMsd2WymJjDFdG1SCBbJ8q','degen_quota'),
('RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','bull_backoffice'),
('SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','shiftprinter'),
('SjFc5xCjunC2GAEsZ7CNhDiAARXBGnTLJghr1W16u6f2','chad_wire'),
('T5bFnyVxgiYPbtZXDUhERGnMBmaX3k5nUXWNJrZj4w2j','baglord_nightshift'),
('TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','vaultfarmer'),
('TVFsuG35TCjWF3q6QkwYqZi1VUW7aLFZcvxERH6GbNPi','cubiclejockey30'),
('ToDTZXWy58HxqPSH64JnR7Buxv9HTQ8V8FdsyrahZSfz','clerkwatcher'),
('UA7w1dZaSabvZrZmbx4k6zm2BuLow9N2cDuvvTP2YpzV','hands_tape'),
('UULKeR8k6j1yGZpa6aBYJo9FNQjQ5xFX78xiEn4RHuya','tbll_capital'),
('VQxbQ3TDHkMygGmtZ3qaNuDfvWQTp2S4h7v9p7J97Tbb','ape_nightshift'),
('WqaAdsEhLfUqEB7JfLi9hmGzJga66TjAwehkutCVugF2','lord_payroll'),
('WvKQKspnYcjfqFidTzxsEZsGyGetgyigMg1yJZ7MbDXL','lly_keeper'),
('XkBCbBs1LTy16L27qxPH2DAGjjNZnYBTZCdGnU2WhKMa','candleholder'),
('YZCjY84F4q1kZ7HNpMoso9mA4sweHmSF2HKeHMs8UBqo','bull_shift'),
('ZL4TWbfCtZUiwEHLH6z1wsFvWAeZ12F9p1FaHeryQYpJ','wickkeeper'),
('ZbNYx3vx4WSXdSCXao7FgSPiETd3b62YFmv3msR3HisA','nightshiftgoblin17'),
('aj5JfbLsdJWwre7RcmNHisAPkvgou9Tu3KPL5F5gRAoN','carrygrinder21'),
('au2Q4HtK7mywVq2XK5MUh1rha7EXcQADMkaMBGC7CYmU','pg_degen'),
('baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','couponape36'),
('bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','tbll_farmer'),
('cES5aVzWCozgeT4xPoqg7AsRAcNpsQ459coLeTSkL2L5','gld_holder'),
('cZFSA3twdYjiSYd2WAY82cHv4WG4br4G92AUu5MwzqyS','yieldlord'),
('g66VHjXcbpF7wAwkuMKcRSBWDgpzVW5x5KpXsAMP1dsr','staplerhands99'),
('gUUohZVWwH6GEy8Zr4JV7Y79uPSxmeRt4LzrLZujCsjg','deltakeeper'),
('h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','sniper_nightshift'),
('h85TESphRgjDpFpfgsqWwpoKhVscDeTQjJUoDRc2gh7X','flowholder50'),
('hFpiyPm8UKg5hBdTzXLm94H1QEiZHNNL8nKysw6kPrTN','booksweeper56'),
('jfNeBRxdDEEPN6vf6nDHytr88LcrkqFV3BCwJuAFi9jM','staplersniper94'),
('jjaN7AxhZAXmrvAjrjWQcXinvqtJvVDMFBTAvQSMvEKB','lanyardwhale'),
('k9NHpDyWT7aki8UgXLKkMzSqrEzjXeVJHPdfGyH5a4mV','goblin_block'),
('nABDma8ZFrqrJwDQsrfc1wqXPd1xVRxvvhC5G5QPRBve','payrolllord'),
('nVdrPN1x9sJDws1UwwHXSmSxDen32CfnYpr1svigsQHL','lord_memo'),
('nmoFDY4jxwWi7N5e4zcsTagSjnXQDkevRjMdw65asc1S','ko_bot'),
('osfPt3SoPb3s7PJwR5KvXZ8pTbVtfQXX6Up5bHu2dsL3','unh_bull'),
('p4pRUbkKukN2njr47z9XLFbvVDwQco4kPzBsdXXTxPui','nightshiftmaxi'),
('p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','memostacker'),
('peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','printgoblin22'),
('pwd8Ac7k2hKiMkzBffou3QiSNFMb92kBpq64vFy8jgHo','lanyardgrinder'),
('q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','couponbull18'),
('qVGw6wKZFSmYwPASTiepmVwK9CebepRPtqf8CjQWqUW5','baglord_wick'),
('s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','aapl_pusher'),
('sRMVnGH4joMw6SCMfEwDhEzSQn3F3DkaCwVmTbe8CQEh','fillgoblin47'),
('siFmeoSaRs6MhKCXK56ScZSzLtpT3qXeWweQkYF8dA3c','maxi_nightshift'),
('t4Zx18iZgPCKdSNDVEvrzEiytcxSrSyqGkAusFYyVAeT','yieldkeeper'),
('uQCXFLBWwqMtNjihMyz3pKhjX8Cyk6j1RTkPA5qr4mS4','filldegen35'),
('uisJorf8tmKduAtLkUHcneBfFd28DafQTkf9L2bXU1EV','anon_severance'),
('usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','nvda_hands'),
('vA9ybRpg5mw1UJoa6jNLtvYHksujBg6zh1FdYjH5beV9','carryjockey70'),
('wJTFjs2Wm4R2sejeRCRoYkpPxiEcELeUu9jQhNedevQR','chad_spread'),
('wbuGdkNuQkj7mWiY7h83UNiAZdwpgJn4MhiDG1i2b1iU','auditbull35'),
('wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','lly_bot'),
('z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','yieldrunner6')on conflict (address) do nothing;

-- (draw_position, serial, owner, hired_at) for the 512 the collection ships with.
-- Loaded into a temporary table so the two statements that follow — claim the
-- reveal position, set the ownership — read the same list and cannot disagree
-- about it. The table is `on commit drop`, so it does not survive the migration.
create temporary table genesis_crew (
  draw_position integer primary key,
  serial        integer not null unique,
  owner         text    not null,
  hired_at      timestamptz not null
) on commit drop;

insert into genesis_crew (draw_position, serial, owner, hired_at) values
(0,2867,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-01-06T00:00:00.000Z'::timestamptz),
(1,995,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-01-06T00:00:00.000Z'::timestamptz),
(2,3679,'3WrSVq3wACYa3jkbJssjbTqR4C5Emz5JCXABYbJoqGLR','2026-01-07T22:05:54.594Z'::timestamptz),
(3,3355,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-06T12:35:17.756Z'::timestamptz),
(4,1885,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-01-08T23:02:33.562Z'::timestamptz),
(5,62,'UULKeR8k6j1yGZpa6aBYJo9FNQjQ5xFX78xiEn4RHuya','2026-01-08T02:50:26.000Z'::timestamptz),
(6,2967,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-01-08T08:57:29.158Z'::timestamptz),
(7,2234,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-01-09T13:37:38.311Z'::timestamptz),
(8,3928,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-10T10:52:51.494Z'::timestamptz),
(9,2227,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-07T04:06:23.819Z'::timestamptz),
(10,2638,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-01-11T00:15:06.601Z'::timestamptz),
(11,2007,'SjFc5xCjunC2GAEsZ7CNhDiAARXBGnTLJghr1W16u6f2','2026-01-11T10:58:09.419Z'::timestamptz),
(12,3020,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-11T12:33:40.255Z'::timestamptz),
(13,4745,'VQxbQ3TDHkMygGmtZ3qaNuDfvWQTp2S4h7v9p7J97Tbb','2026-01-12T07:50:32.403Z'::timestamptz),
(14,4511,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-01-09T21:44:46.519Z'::timestamptz),
(15,284,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-01-10T22:32:01.066Z'::timestamptz),
(16,2823,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-01-12T23:42:37.764Z'::timestamptz),
(17,3480,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-01-11T04:58:59.352Z'::timestamptz),
(18,731,'h85TESphRgjDpFpfgsqWwpoKhVscDeTQjJUoDRc2gh7X','2026-01-11T20:53:37.513Z'::timestamptz),
(19,4109,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-01-11T15:07:20.525Z'::timestamptz),
(20,1852,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-01-13T12:00:36.478Z'::timestamptz),
(21,3354,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-01-14T22:11:39.305Z'::timestamptz),
(22,3591,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-01-13T02:45:52.887Z'::timestamptz),
(23,3138,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-01-15T10:35:26.049Z'::timestamptz),
(24,295,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-15T06:41:14.178Z'::timestamptz),
(25,2087,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-01-16T00:38:17.746Z'::timestamptz),
(26,3863,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-01-15T09:57:32.393Z'::timestamptz),
(27,1291,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-01-14T18:26:50.122Z'::timestamptz),
(28,2833,'h85TESphRgjDpFpfgsqWwpoKhVscDeTQjJUoDRc2gh7X','2026-01-15T07:13:03.095Z'::timestamptz),
(29,4661,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-01-15T20:42:02.102Z'::timestamptz),
(30,4747,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-01-17T06:51:54.210Z'::timestamptz),
(31,1289,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-01-15T11:56:36.272Z'::timestamptz),
(32,2012,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-01-19T04:40:48.108Z'::timestamptz),
(33,4749,'4xuZhrBftGYDuMqRU6wGD9jsAKvQxTkdXuraaVQRffqy','2026-01-19T10:23:52.031Z'::timestamptz),
(34,1261,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-01-19T11:30:22.855Z'::timestamptz),
(35,1706,'XkBCbBs1LTy16L27qxPH2DAGjjNZnYBTZCdGnU2WhKMa','2026-01-16T17:01:22.476Z'::timestamptz),
(36,42,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-01-17T11:37:50.373Z'::timestamptz),
(37,3067,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-01-17T18:18:12.351Z'::timestamptz),
(38,3454,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-19T08:25:58.726Z'::timestamptz),
(39,1200,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-01-19T03:45:51.700Z'::timestamptz),
(40,4358,'XkBCbBs1LTy16L27qxPH2DAGjjNZnYBTZCdGnU2WhKMa','2026-01-20T20:42:55.977Z'::timestamptz),
(41,786,'wbuGdkNuQkj7mWiY7h83UNiAZdwpgJn4MhiDG1i2b1iU','2026-01-22T03:55:51.730Z'::timestamptz),
(42,2090,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-01-22T08:01:14.065Z'::timestamptz),
(43,4574,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-22T15:54:52.667Z'::timestamptz),
(44,3786,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-01-23T03:30:04.717Z'::timestamptz),
(45,3259,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-01-22T16:10:56.297Z'::timestamptz),
(46,4780,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-01-21T19:47:50.322Z'::timestamptz),
(47,1532,'qVGw6wKZFSmYwPASTiepmVwK9CebepRPtqf8CjQWqUW5','2026-01-22T07:40:53.242Z'::timestamptz),
(48,1499,'k9NHpDyWT7aki8UgXLKkMzSqrEzjXeVJHPdfGyH5a4mV','2026-01-22T06:44:17.383Z'::timestamptz),
(49,1080,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-01-23T11:10:10.087Z'::timestamptz),
(50,3838,'aj5JfbLsdJWwre7RcmNHisAPkvgou9Tu3KPL5F5gRAoN','2026-01-22T12:03:26.428Z'::timestamptz),
(51,96,'wJTFjs2Wm4R2sejeRCRoYkpPxiEcELeUu9jQhNedevQR','2026-01-23T21:03:56.163Z'::timestamptz),
(52,394,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-01-23T07:02:47.800Z'::timestamptz),
(53,1949,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-01-25T17:14:01.548Z'::timestamptz),
(54,2939,'9Bh3WaVoXyWK9sm3fq97JEXrSEQkkF9Xc4WCpM7hQ2Rr','2026-01-23T10:28:37.769Z'::timestamptz),
(55,4354,'hFpiyPm8UKg5hBdTzXLm94H1QEiZHNNL8nKysw6kPrTN','2026-01-26T11:53:09.411Z'::timestamptz),
(56,465,'siFmeoSaRs6MhKCXK56ScZSzLtpT3qXeWweQkYF8dA3c','2026-01-24T00:30:48.510Z'::timestamptz),
(57,768,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-01-27T01:51:55.461Z'::timestamptz),
(58,3635,'au2Q4HtK7mywVq2XK5MUh1rha7EXcQADMkaMBGC7CYmU','2026-01-25T07:36:15.680Z'::timestamptz),
(59,1708,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-01-27T10:25:16.596Z'::timestamptz),
(60,4862,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-01-27T23:35:07.465Z'::timestamptz),
(61,4682,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-01-26T01:31:13.990Z'::timestamptz),
(62,1722,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-01-27T02:11:09.378Z'::timestamptz),
(63,2696,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-01-27T05:33:41.160Z'::timestamptz),
(64,4101,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-01-28T08:52:24.687Z'::timestamptz),
(65,3388,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-01-28T23:21:03.301Z'::timestamptz),
(66,865,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-01-27T11:09:46.171Z'::timestamptz),
(67,3633,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-01-31T08:55:15.707Z'::timestamptz),
(68,514,'3cSYcZcYiB8HU7wMVAGRL7StsXt1gXgL3rdV4tsBG1Cd','2026-01-29T21:44:01.521Z'::timestamptz),
(69,2253,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-01-29T06:38:11.200Z'::timestamptz),
(70,3770,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-01-31T03:59:03.763Z'::timestamptz),
(71,2887,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-02-01T10:45:56.044Z'::timestamptz),
(72,2744,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-01-31T11:15:50.591Z'::timestamptz),
(73,1726,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-01-30T13:04:26.400Z'::timestamptz),
(74,2043,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-01-31T09:19:25.931Z'::timestamptz),
(75,2480,'MQNvSuGofcVPe4hv5TcJHfMTt1qVv2owZ9zBTuf2XBVj','2026-02-01T16:43:52.841Z'::timestamptz),
(76,3872,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-02-02T05:01:06.241Z'::timestamptz),
(77,4479,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-31T09:13:18.338Z'::timestamptz),
(78,1487,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-02-03T06:47:23.579Z'::timestamptz),
(79,1920,'RHjPEJYcYyBiG2EnFeXYq7UMqnNXu3HAJhwzbYYmu5Cv','2026-02-03T10:23:36.779Z'::timestamptz),
(80,4179,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-01T08:09:21.753Z'::timestamptz),
(81,1463,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-02-04T04:28:09.185Z'::timestamptz),
(82,917,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-02-01T20:06:02.017Z'::timestamptz),
(83,4545,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-02-03T07:01:25.913Z'::timestamptz),
(84,1030,'3ehHTBeunc2tsrUWY9e3RmGiQkpipNKy66c6h9qtTMJ7','2026-02-02T23:34:59.494Z'::timestamptz),
(85,2400,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-02-06T02:53:34.825Z'::timestamptz),
(86,1893,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-02-04T01:55:57.248Z'::timestamptz),
(87,4083,'Ki7sGTgPfaTWWVPhnmSQypacnQqfX36uYk81in7Mmnih','2026-02-05T08:30:53.730Z'::timestamptz),
(88,3865,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-02-06T23:34:56.142Z'::timestamptz),
(89,3736,'9k61cL8f1a8Z1phdMm4B9zGenzkwNouNJLrg8nzgCmTd','2026-02-07T17:57:38.680Z'::timestamptz),
(90,1023,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-02-05T22:21:49.294Z'::timestamptz),
(91,4691,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-02-08T16:08:36.755Z'::timestamptz),
(92,2778,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-02-06T13:53:11.932Z'::timestamptz),
(93,2850,'NYQbWWNBQWTR3T29TrDUaJy7MgjLVweCR6B5ouGVuhdj','2026-02-08T18:42:18.419Z'::timestamptz),
(94,3948,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-02-07T11:35:29.798Z'::timestamptz),
(95,3761,'cES5aVzWCozgeT4xPoqg7AsRAcNpsQ459coLeTSkL2L5','2026-02-08T11:14:57.941Z'::timestamptz),
(96,3683,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-02-08T06:54:22.647Z'::timestamptz),
(97,643,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-02-10T05:31:12.467Z'::timestamptz),
(98,2868,'9k61cL8f1a8Z1phdMm4B9zGenzkwNouNJLrg8nzgCmTd','2026-02-08T11:51:32.402Z'::timestamptz),
(99,1140,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-02-08T08:59:40.596Z'::timestamptz),
(100,666,'p4pRUbkKukN2njr47z9XLFbvVDwQco4kPzBsdXXTxPui','2026-02-09T02:13:13.105Z'::timestamptz),
(101,2275,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-02-10T05:30:45.008Z'::timestamptz),
(102,1321,'4BKvPBeTAnjSwpe7dpEXZHHNeNqfm6377x2ojmH2mRFE','2026-02-10T01:16:41.733Z'::timestamptz),
(103,4047,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-02-11T16:30:46.341Z'::timestamptz),
(104,2088,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-02-10T05:33:14.325Z'::timestamptz),
(105,3380,'2UGbkX5c2DmJ7LhDejmmC4z1DnLEn9DFZ2qZeZowPKYT','2026-02-12T21:02:31.003Z'::timestamptz),
(106,368,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-02-13T12:45:01.683Z'::timestamptz),
(107,1743,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-02-13T08:01:17.747Z'::timestamptz),
(108,3757,'MQNvSuGofcVPe4hv5TcJHfMTt1qVv2owZ9zBTuf2XBVj','2026-02-13T18:01:29.739Z'::timestamptz),
(109,3448,'WvKQKspnYcjfqFidTzxsEZsGyGetgyigMg1yJZ7MbDXL','2026-02-14T16:21:06.178Z'::timestamptz),
(110,2106,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-02-12T15:18:28.620Z'::timestamptz),
(111,2456,'h85TESphRgjDpFpfgsqWwpoKhVscDeTQjJUoDRc2gh7X','2026-02-15T10:31:42.722Z'::timestamptz),
(112,2640,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-02-15T20:41:59.550Z'::timestamptz),
(113,653,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-02-16T03:55:47.826Z'::timestamptz),
(114,1007,'QDLySA1CJmfeNEB7Bt2ScLYgfuLDm3jp4wGR16SNYyZX','2026-02-15T03:57:07.434Z'::timestamptz),
(115,4158,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-14T22:58:29.761Z'::timestamptz),
(116,2862,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-02-14T08:26:44.506Z'::timestamptz),
(117,4931,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-02-17T10:25:19.505Z'::timestamptz),
(118,3690,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-02-17T17:41:28.708Z'::timestamptz),
(119,4010,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-15T13:11:10.174Z'::timestamptz),
(120,3439,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-17T00:26:44.926Z'::timestamptz),
(121,3364,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-15T16:37:02.162Z'::timestamptz),
(122,858,'au2Q4HtK7mywVq2XK5MUh1rha7EXcQADMkaMBGC7CYmU','2026-02-16T10:47:02.210Z'::timestamptz),
(123,3726,'3ehHTBeunc2tsrUWY9e3RmGiQkpipNKy66c6h9qtTMJ7','2026-02-18T21:50:55.269Z'::timestamptz),
(124,2252,'pwd8Ac7k2hKiMkzBffou3QiSNFMb92kBpq64vFy8jgHo','2026-02-16T17:46:03.752Z'::timestamptz),
(125,94,'3ehHTBeunc2tsrUWY9e3RmGiQkpipNKy66c6h9qtTMJ7','2026-02-19T11:55:57.966Z'::timestamptz),
(126,1239,'qVGw6wKZFSmYwPASTiepmVwK9CebepRPtqf8CjQWqUW5','2026-02-19T07:19:18.891Z'::timestamptz),
(127,4013,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-02-21T11:19:49.422Z'::timestamptz),
(128,3249,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-20T17:00:42.390Z'::timestamptz),
(129,2075,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-02-20T19:26:54.648Z'::timestamptz),
(130,2658,'vA9ybRpg5mw1UJoa6jNLtvYHksujBg6zh1FdYjH5beV9','2026-02-22T14:47:57.764Z'::timestamptz),
(131,3397,'UULKeR8k6j1yGZpa6aBYJo9FNQjQ5xFX78xiEn4RHuya','2026-02-20T04:19:50.731Z'::timestamptz),
(132,4763,'nABDma8ZFrqrJwDQsrfc1wqXPd1xVRxvvhC5G5QPRBve','2026-02-22T05:02:36.826Z'::timestamptz),
(133,1152,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-02-22T23:55:59.118Z'::timestamptz),
(134,3654,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-02-23T04:24:51.713Z'::timestamptz),
(135,1778,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-02-21T03:59:30.843Z'::timestamptz),
(136,3419,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-02-21T16:21:38.089Z'::timestamptz),
(137,1527,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-02-25T03:16:55.164Z'::timestamptz),
(138,3076,'UULKeR8k6j1yGZpa6aBYJo9FNQjQ5xFX78xiEn4RHuya','2026-02-25T00:38:40.873Z'::timestamptz),
(139,1897,'JrH65VFWrnmYhyW5ptuiBquyb8RiMqvXuNBe2r3Qo4Bk','2026-02-25T09:02:26.619Z'::timestamptz),
(140,4985,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-02-22T08:57:51.291Z'::timestamptz),
(141,2548,'EUjBYtJvv35BoNFqnZjdteGDEVYHxr7Pr9KfweDJrpjo','2026-02-24T04:06:34.398Z'::timestamptz),
(142,4795,'3ehHTBeunc2tsrUWY9e3RmGiQkpipNKy66c6h9qtTMJ7','2026-02-22T22:19:07.604Z'::timestamptz),
(143,513,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-02-24T20:35:08.365Z'::timestamptz),
(144,1096,'QCRsqhZdAQPaRDXXd9vCTPZm4jBHVJ9opug33K58V9sK','2026-02-26T09:47:09.742Z'::timestamptz),
(145,4710,'KvpN2fpaR9MKxZBeMPNVJ7hecZmPYnkQXEMiS8tGpmNS','2026-02-24T05:46:13.446Z'::timestamptz),
(146,4078,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-02-27T14:50:08.595Z'::timestamptz),
(147,3913,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-02-25T03:36:52.649Z'::timestamptz),
(148,3567,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-02-28T17:15:01.133Z'::timestamptz),
(149,2764,'ZL4TWbfCtZUiwEHLH6z1wsFvWAeZ12F9p1FaHeryQYpJ','2026-02-27T16:05:13.363Z'::timestamptz),
(150,1149,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-02-26T20:19:09.265Z'::timestamptz),
(151,891,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-03-01T10:31:15.199Z'::timestamptz),
(152,2157,'HYU5649zRdCYRzh2QC5B9ztiobiwUq3LYyHcWRY4e1Th','2026-03-02T09:12:12.263Z'::timestamptz),
(153,4385,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-02-27T19:09:59.775Z'::timestamptz),
(154,3762,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-03-01T13:38:34.604Z'::timestamptz),
(155,4828,'3cSYcZcYiB8HU7wMVAGRL7StsXt1gXgL3rdV4tsBG1Cd','2026-02-28T12:35:11.082Z'::timestamptz),
(156,3064,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-03-03T08:19:46.939Z'::timestamptz),
(157,3389,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-02-28T21:58:12.078Z'::timestamptz),
(158,2962,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-28T20:28:38.911Z'::timestamptz),
(159,4919,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-03-01T23:06:20.291Z'::timestamptz),
(160,773,'nmoFDY4jxwWi7N5e4zcsTagSjnXQDkevRjMdw65asc1S','2026-03-02T23:27:58.996Z'::timestamptz),
(161,3970,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-03-04T02:01:15.115Z'::timestamptz),
(162,1390,'h85TESphRgjDpFpfgsqWwpoKhVscDeTQjJUoDRc2gh7X','2026-03-02T06:37:33.352Z'::timestamptz),
(163,136,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-03-03T02:17:00.541Z'::timestamptz),
(164,2146,'2UGbkX5c2DmJ7LhDejmmC4z1DnLEn9DFZ2qZeZowPKYT','2026-03-04T22:06:25.346Z'::timestamptz),
(165,589,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-03-06T02:33:07.619Z'::timestamptz),
(166,20,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-04T17:39:49.668Z'::timestamptz),
(167,1366,'Q19hwFNs8PvmjCCdR2fMNjTNTAS5Ckno2xybmn2AQYjm','2026-03-05T07:23:45.953Z'::timestamptz),
(168,1456,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-06T20:39:24.885Z'::timestamptz),
(169,4935,'g66VHjXcbpF7wAwkuMKcRSBWDgpzVW5x5KpXsAMP1dsr','2026-03-05T04:50:32.523Z'::timestamptz),
(170,1924,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-03-08T12:44:42.669Z'::timestamptz),
(171,977,'8qpBGG6atMZdNqgPNsKrUsydYM7nXqqoVSTdr6j3wy9n','2026-03-06T12:02:35.370Z'::timestamptz),
(172,2829,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-03-06T07:25:47.711Z'::timestamptz),
(173,3992,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-03-09T19:00:54.872Z'::timestamptz),
(174,4304,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-03-08T12:20:43.061Z'::timestamptz),
(175,4585,'RVDVQaj22zGAGpAEyJRrkkiMsd2WymJjDFdG1SCBbJ8q','2026-03-08T21:46:41.684Z'::timestamptz),
(176,2237,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-03-09T08:02:39.497Z'::timestamptz),
(177,3109,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-09T17:32:59.767Z'::timestamptz),
(178,2149,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-03-11T00:14:59.746Z'::timestamptz),
(179,4265,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-11T17:26:44.182Z'::timestamptz),
(180,404,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-03-12T00:56:16.920Z'::timestamptz),
(181,370,'p4pRUbkKukN2njr47z9XLFbvVDwQco4kPzBsdXXTxPui','2026-03-12T09:25:42.458Z'::timestamptz),
(182,3184,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-03-11T07:26:26.761Z'::timestamptz),
(183,353,'vA9ybRpg5mw1UJoa6jNLtvYHksujBg6zh1FdYjH5beV9','2026-03-09T08:10:57.456Z'::timestamptz),
(184,1740,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-03-09T19:32:32.958Z'::timestamptz),
(185,4281,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-03-12T19:10:41.988Z'::timestamptz),
(186,866,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-03-10T21:53:42.765Z'::timestamptz),
(187,1601,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-03-11T15:52:26.470Z'::timestamptz),
(188,2131,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-03-13T17:16:05.459Z'::timestamptz),
(189,610,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-03-11T13:40:17.796Z'::timestamptz),
(190,2942,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-03-15T02:06:06.242Z'::timestamptz),
(191,3695,'8qpBGG6atMZdNqgPNsKrUsydYM7nXqqoVSTdr6j3wy9n','2026-03-13T22:23:00.745Z'::timestamptz),
(192,4088,'EcUf8HcSwQwEYYzYNmJjRFXKw1d1nZFkWKRbviHASHkB','2026-03-15T12:35:54.149Z'::timestamptz),
(193,4218,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-03-15T18:22:00.200Z'::timestamptz),
(194,2241,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-03-17T01:09:05.233Z'::timestamptz),
(195,1960,'UA7w1dZaSabvZrZmbx4k6zm2BuLow9N2cDuvvTP2YpzV','2026-03-14T01:14:08.507Z'::timestamptz),
(196,854,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-03-17T20:18:28.738Z'::timestamptz),
(197,2595,'uQCXFLBWwqMtNjihMyz3pKhjX8Cyk6j1RTkPA5qr4mS4','2026-03-16T06:31:26.433Z'::timestamptz),
(198,2291,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-03-15T16:15:37.280Z'::timestamptz),
(199,4641,'cZFSA3twdYjiSYd2WAY82cHv4WG4br4G92AUu5MwzqyS','2026-03-15T01:51:45.156Z'::timestamptz),
(200,4380,'XkBCbBs1LTy16L27qxPH2DAGjjNZnYBTZCdGnU2WhKMa','2026-03-18T14:31:28.616Z'::timestamptz),
(201,4653,'siFmeoSaRs6MhKCXK56ScZSzLtpT3qXeWweQkYF8dA3c','2026-03-16T22:33:04.443Z'::timestamptz),
(202,3142,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-19T09:02:57.712Z'::timestamptz),
(203,3116,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-03-17T18:11:48.787Z'::timestamptz),
(204,3233,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-19T13:55:40.922Z'::timestamptz),
(205,3904,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-03-18T12:15:38.870Z'::timestamptz),
(206,4517,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-03-17T14:19:34.335Z'::timestamptz),
(207,1912,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-17T23:41:47.770Z'::timestamptz),
(208,3847,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-21T11:20:07.991Z'::timestamptz),
(209,4126,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-03-18T15:18:33.756Z'::timestamptz),
(210,4328,'Ki7sGTgPfaTWWVPhnmSQypacnQqfX36uYk81in7Mmnih','2026-03-21T15:58:30.713Z'::timestamptz),
(211,881,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-23T00:43:54.511Z'::timestamptz),
(212,595,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-21T02:29:46.608Z'::timestamptz),
(213,1571,'EcUf8HcSwQwEYYzYNmJjRFXKw1d1nZFkWKRbviHASHkB','2026-03-21T14:52:22.327Z'::timestamptz),
(214,143,'QCRsqhZdAQPaRDXXd9vCTPZm4jBHVJ9opug33K58V9sK','2026-03-21T08:05:43.736Z'::timestamptz),
(215,3332,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-03-23T12:00:08.488Z'::timestamptz),
(216,497,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-03-22T17:09:25.150Z'::timestamptz),
(217,799,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-23T03:59:35.047Z'::timestamptz),
(218,1936,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-03-22T09:51:23.290Z'::timestamptz),
(219,3339,'t4Zx18iZgPCKdSNDVEvrzEiytcxSrSyqGkAusFYyVAeT','2026-03-22T01:12:44.906Z'::timestamptz),
(220,1725,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-25T13:53:35.554Z'::timestamptz),
(221,285,'ZL4TWbfCtZUiwEHLH6z1wsFvWAeZ12F9p1FaHeryQYpJ','2026-03-23T04:55:19.649Z'::timestamptz),
(222,2542,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-03-24T01:42:09.764Z'::timestamptz),
(223,2240,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-24T09:18:10.941Z'::timestamptz),
(224,974,'EJP8o6tCeeLQmLzfJWur2MspXnm1X5PnsiakkNsnci1S','2026-03-25T07:03:41.394Z'::timestamptz),
(225,3278,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-03-25T22:44:50.977Z'::timestamptz),
(226,2360,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-03-27T04:46:48.970Z'::timestamptz),
(227,217,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-03-26T01:26:04.408Z'::timestamptz),
(228,679,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-26T05:54:31.845Z'::timestamptz),
(229,611,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-28T15:34:40.879Z'::timestamptz),
(230,2614,'EUjBYtJvv35BoNFqnZjdteGDEVYHxr7Pr9KfweDJrpjo','2026-03-27T14:49:26.474Z'::timestamptz),
(231,1394,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-03-27T22:13:31.800Z'::timestamptz),
(232,4760,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-27T06:43:19.244Z'::timestamptz),
(233,1184,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-03-29T03:14:08.520Z'::timestamptz),
(234,524,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-03-30T22:20:25.349Z'::timestamptz),
(235,939,'ZbNYx3vx4WSXdSCXao7FgSPiETd3b62YFmv3msR3HisA','2026-03-27T16:55:02.344Z'::timestamptz),
(236,713,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-03-30T23:05:42.279Z'::timestamptz),
(237,3175,'Q19hwFNs8PvmjCCdR2fMNjTNTAS5Ckno2xybmn2AQYjm','2026-03-30T17:51:35.461Z'::timestamptz),
(238,1718,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-03-30T11:34:44.135Z'::timestamptz),
(239,904,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-03-30T18:39:40.693Z'::timestamptz),
(240,2656,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-03-31T03:04:59.180Z'::timestamptz),
(241,636,'Q19hwFNs8PvmjCCdR2fMNjTNTAS5Ckno2xybmn2AQYjm','2026-03-31T03:11:12.932Z'::timestamptz),
(242,1761,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-03-31T08:11:03.423Z'::timestamptz),
(243,3818,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-04-02T14:07:04.670Z'::timestamptz),
(244,1577,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-04-02T03:39:16.803Z'::timestamptz),
(245,1959,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-04-01T07:58:17.956Z'::timestamptz),
(246,632,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-04-03T20:35:00.035Z'::timestamptz),
(247,628,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-04-03T20:16:20.253Z'::timestamptz),
(248,3261,'5mEW6FSZbfg9rV2j6Rgjo3Zr96nh1yzTKetyJBAJTWqR','2026-04-03T17:26:46.186Z'::timestamptz),
(249,4372,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-04-02T04:49:36.995Z'::timestamptz),
(250,2793,'9SnXcRSFTELMTvtkBU9boqD5ogpspVRkTF3ziGJQoGiM','2026-04-02T01:32:07.745Z'::timestamptz),
(251,2878,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-04-06T03:49:11.849Z'::timestamptz),
(252,1519,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-04-05T10:41:54.891Z'::timestamptz),
(253,3572,'Ki7sGTgPfaTWWVPhnmSQypacnQqfX36uYk81in7Mmnih','2026-04-03T04:24:53.831Z'::timestamptz),
(254,1579,'t4Zx18iZgPCKdSNDVEvrzEiytcxSrSyqGkAusFYyVAeT','2026-04-03T16:09:20.040Z'::timestamptz),
(255,4554,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-04-03T22:54:21.566Z'::timestamptz),
(256,3275,'ToDTZXWy58HxqPSH64JnR7Buxv9HTQ8V8FdsyrahZSfz','2026-04-04T17:53:28.451Z'::timestamptz),
(257,2532,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-04-04T22:29:45.308Z'::timestamptz),
(258,1408,'ToDTZXWy58HxqPSH64JnR7Buxv9HTQ8V8FdsyrahZSfz','2026-04-07T20:45:42.778Z'::timestamptz),
(259,1106,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-04-07T21:47:19.049Z'::timestamptz),
(260,744,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-04-06T06:13:31.154Z'::timestamptz),
(261,4184,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-04-06T08:32:38.868Z'::timestamptz),
(262,549,'nABDma8ZFrqrJwDQsrfc1wqXPd1xVRxvvhC5G5QPRBve','2026-04-08T15:35:51.128Z'::timestamptz),
(263,2960,'3ehHTBeunc2tsrUWY9e3RmGiQkpipNKy66c6h9qtTMJ7','2026-04-07T14:22:03.082Z'::timestamptz),
(264,1338,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-04-09T08:43:12.323Z'::timestamptz),
(265,4754,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-04-08T11:07:15.250Z'::timestamptz),
(266,212,'nVdrPN1x9sJDws1UwwHXSmSxDen32CfnYpr1svigsQHL','2026-04-08T20:02:52.162Z'::timestamptz),
(267,1207,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-04-09T23:46:24.811Z'::timestamptz),
(268,2079,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-04-08T11:47:55.875Z'::timestamptz),
(269,765,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-04-10T05:33:12.313Z'::timestamptz),
(270,4778,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-04-11T05:40:56.374Z'::timestamptz),
(271,4468,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-04-13T02:51:56.794Z'::timestamptz),
(272,892,'RHjPEJYcYyBiG2EnFeXYq7UMqnNXu3HAJhwzbYYmu5Cv','2026-04-13T13:21:17.163Z'::timestamptz),
(273,3830,'QCRsqhZdAQPaRDXXd9vCTPZm4jBHVJ9opug33K58V9sK','2026-04-10T19:48:16.124Z'::timestamptz),
(274,1449,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-04-12T16:30:00.190Z'::timestamptz),
(275,2853,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-04-13T07:31:18.317Z'::timestamptz),
(276,3924,'hFpiyPm8UKg5hBdTzXLm94H1QEiZHNNL8nKysw6kPrTN','2026-04-13T18:07:31.355Z'::timestamptz),
(277,3445,'QDLySA1CJmfeNEB7Bt2ScLYgfuLDm3jp4wGR16SNYyZX','2026-04-12T13:21:38.345Z'::timestamptz),
(278,204,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-04-15T14:35:16.164Z'::timestamptz),
(279,2639,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-04-13T14:34:30.539Z'::timestamptz),
(280,565,'9SnXcRSFTELMTvtkBU9boqD5ogpspVRkTF3ziGJQoGiM','2026-04-15T21:52:55.218Z'::timestamptz),
(281,3075,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-04-13T19:43:54.658Z'::timestamptz),
(282,385,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-04-15T04:01:53.857Z'::timestamptz),
(283,1820,'uQCXFLBWwqMtNjihMyz3pKhjX8Cyk6j1RTkPA5qr4mS4','2026-04-16T07:07:50.728Z'::timestamptz),
(284,1921,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-04-14T12:29:32.248Z'::timestamptz),
(285,2821,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-04-16T12:38:14.746Z'::timestamptz),
(286,823,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-04-16T05:25:18.196Z'::timestamptz),
(287,2645,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-04-16T12:51:57.632Z'::timestamptz),
(288,4247,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-04-15T22:06:38.413Z'::timestamptz),
(289,165,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-04-19T04:59:41.989Z'::timestamptz),
(290,3921,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-04-17T12:49:40.946Z'::timestamptz),
(291,4879,'T5bFnyVxgiYPbtZXDUhERGnMBmaX3k5nUXWNJrZj4w2j','2026-04-17T18:11:41.744Z'::timestamptz),
(292,2129,'RUz37ya9EMZTCDjoVw4YbZpjb8q6YN7HiVrybpX3dzic','2026-04-17T10:22:04.704Z'::timestamptz),
(293,4866,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-04-17T18:37:05.310Z'::timestamptz),
(294,775,'97C6BD8uKT5UecxptgoWex9TwhPng2BpXgyEbE5mDNFy','2026-04-18T22:24:49.704Z'::timestamptz),
(295,4835,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-04-20T17:08:22.153Z'::timestamptz),
(296,3553,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-04-20T10:13:39.191Z'::timestamptz),
(297,33,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-04-19T10:29:52.725Z'::timestamptz),
(298,2794,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-04-21T18:50:46.151Z'::timestamptz),
(299,139,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-04-22T12:48:49.423Z'::timestamptz),
(300,2197,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-04-20T05:15:54.252Z'::timestamptz),
(301,1557,'SjFc5xCjunC2GAEsZ7CNhDiAARXBGnTLJghr1W16u6f2','2026-04-23T07:30:11.928Z'::timestamptz),
(302,333,'HYU5649zRdCYRzh2QC5B9ztiobiwUq3LYyHcWRY4e1Th','2026-04-20T15:09:23.076Z'::timestamptz),
(303,2104,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-04-21T08:49:50.208Z'::timestamptz),
(304,4986,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-04-24T19:51:46.212Z'::timestamptz),
(305,4934,'jjaN7AxhZAXmrvAjrjWQcXinvqtJvVDMFBTAvQSMvEKB','2026-04-22T16:55:27.711Z'::timestamptz),
(306,1342,'jfNeBRxdDEEPN6vf6nDHytr88LcrkqFV3BCwJuAFi9jM','2026-04-21T16:16:05.218Z'::timestamptz),
(307,391,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-04-22T21:16:37.322Z'::timestamptz),
(308,1201,'nVdrPN1x9sJDws1UwwHXSmSxDen32CfnYpr1svigsQHL','2026-04-24T02:12:33.215Z'::timestamptz),
(309,4961,'cZFSA3twdYjiSYd2WAY82cHv4WG4br4G92AUu5MwzqyS','2026-04-25T01:45:08.664Z'::timestamptz),
(310,2842,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-04-26T23:36:44.938Z'::timestamptz),
(311,1308,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-04-23T20:02:09.792Z'::timestamptz),
(312,2403,'WvKQKspnYcjfqFidTzxsEZsGyGetgyigMg1yJZ7MbDXL','2026-04-24T02:53:01.265Z'::timestamptz),
(313,2098,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-04-25T13:54:03.857Z'::timestamptz),
(314,4945,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-04-24T15:46:19.063Z'::timestamptz),
(315,3519,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-04-28T00:08:59.245Z'::timestamptz),
(316,3433,'wbuGdkNuQkj7mWiY7h83UNiAZdwpgJn4MhiDG1i2b1iU','2026-04-26T10:17:33.059Z'::timestamptz),
(317,303,'RHjPEJYcYyBiG2EnFeXYq7UMqnNXu3HAJhwzbYYmu5Cv','2026-04-28T19:22:10.534Z'::timestamptz),
(318,686,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-04-26T07:09:08.472Z'::timestamptz),
(319,2906,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-04-26T15:47:14.296Z'::timestamptz),
(320,4837,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-04-30T04:52:30.023Z'::timestamptz),
(321,1737,'h85TESphRgjDpFpfgsqWwpoKhVscDeTQjJUoDRc2gh7X','2026-04-30T12:44:01.372Z'::timestamptz),
(322,2647,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-04-29T19:06:24.911Z'::timestamptz),
(323,4053,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-05-01T05:31:37.859Z'::timestamptz),
(324,847,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-04-29T19:33:53.318Z'::timestamptz),
(325,444,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-04-29T19:03:57.821Z'::timestamptz),
(326,4399,'cES5aVzWCozgeT4xPoqg7AsRAcNpsQ459coLeTSkL2L5','2026-04-30T12:01:42.497Z'::timestamptz),
(327,339,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-04-29T21:40:53.238Z'::timestamptz),
(328,2303,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-05-02T12:35:02.780Z'::timestamptz),
(329,1894,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-04-30T09:19:15.617Z'::timestamptz),
(330,4300,'siFmeoSaRs6MhKCXK56ScZSzLtpT3qXeWweQkYF8dA3c','2026-05-02T12:28:36.211Z'::timestamptz),
(331,2500,'ZL4TWbfCtZUiwEHLH6z1wsFvWAeZ12F9p1FaHeryQYpJ','2026-05-01T20:09:54.760Z'::timestamptz),
(332,2807,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-03T21:15:57.392Z'::timestamptz),
(333,3151,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-05-01T14:59:01.719Z'::timestamptz),
(334,3748,'gUUohZVWwH6GEy8Zr4JV7Y79uPSxmeRt4LzrLZujCsjg','2026-05-05T01:34:02.795Z'::timestamptz),
(335,3973,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-05-03T14:39:32.951Z'::timestamptz),
(336,4721,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-03T04:04:13.064Z'::timestamptz),
(337,13,'wJTFjs2Wm4R2sejeRCRoYkpPxiEcELeUu9jQhNedevQR','2026-05-04T18:26:14.222Z'::timestamptz),
(338,1790,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-04T18:59:25.385Z'::timestamptz),
(339,2523,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-05-05T09:03:33.100Z'::timestamptz),
(340,696,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-05-07T03:17:03.702Z'::timestamptz),
(341,4455,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-05-07T04:48:17.727Z'::timestamptz),
(342,2766,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-05-06T06:04:41.847Z'::timestamptz),
(343,2564,'YZCjY84F4q1kZ7HNpMoso9mA4sweHmSF2HKeHMs8UBqo','2026-05-07T01:09:07.870Z'::timestamptz),
(344,409,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-05-06T17:49:18.722Z'::timestamptz),
(345,3963,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-05-06T17:13:57.346Z'::timestamptz),
(346,4325,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-05-07T18:24:11.532Z'::timestamptz),
(347,1334,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-05-08T01:17:43.991Z'::timestamptz),
(348,3800,'9Bh3WaVoXyWK9sm3fq97JEXrSEQkkF9Xc4WCpM7hQ2Rr','2026-05-06T19:06:36.230Z'::timestamptz),
(349,3930,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-05-09T21:05:55.728Z'::timestamptz),
(350,4312,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-05-07T01:16:35.396Z'::timestamptz),
(351,2699,'5mEW6FSZbfg9rV2j6Rgjo3Zr96nh1yzTKetyJBAJTWqR','2026-05-09T07:56:53.447Z'::timestamptz),
(352,1087,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-08T18:12:41.677Z'::timestamptz),
(353,2140,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-08T20:38:14.550Z'::timestamptz),
(354,98,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-05-11T19:44:59.963Z'::timestamptz),
(355,2433,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-05-11T13:05:53.445Z'::timestamptz),
(356,1551,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-05-12T17:30:41.646Z'::timestamptz),
(357,2785,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-05-12T09:37:00.338Z'::timestamptz),
(358,2674,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-05-10T22:56:50.686Z'::timestamptz),
(359,2167,'ToDTZXWy58HxqPSH64JnR7Buxv9HTQ8V8FdsyrahZSfz','2026-05-13T15:06:10.970Z'::timestamptz),
(360,929,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-05-12T19:29:49.461Z'::timestamptz),
(361,1935,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-05-12T18:50:28.296Z'::timestamptz),
(362,1169,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-05-12T09:19:18.053Z'::timestamptz),
(363,3585,'g66VHjXcbpF7wAwkuMKcRSBWDgpzVW5x5KpXsAMP1dsr','2026-05-15T14:31:38.844Z'::timestamptz),
(364,484,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-05-13T09:51:38.092Z'::timestamptz),
(365,4811,'SjFc5xCjunC2GAEsZ7CNhDiAARXBGnTLJghr1W16u6f2','2026-05-12T13:24:50.916Z'::timestamptz),
(366,3009,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-05-12T22:11:28.801Z'::timestamptz),
(367,1374,'Ki7sGTgPfaTWWVPhnmSQypacnQqfX36uYk81in7Mmnih','2026-05-14T11:36:27.022Z'::timestamptz),
(368,242,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-05-16T04:23:42.443Z'::timestamptz),
(369,2196,'osfPt3SoPb3s7PJwR5KvXZ8pTbVtfQXX6Up5bHu2dsL3','2026-05-13T21:30:19.859Z'::timestamptz),
(370,3958,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-15T07:02:25.437Z'::timestamptz),
(371,3208,'JrH65VFWrnmYhyW5ptuiBquyb8RiMqvXuNBe2r3Qo4Bk','2026-05-16T08:17:18.723Z'::timestamptz),
(372,1682,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-05-16T01:39:34.237Z'::timestamptz),
(373,591,'2UGbkX5c2DmJ7LhDejmmC4z1DnLEn9DFZ2qZeZowPKYT','2026-05-16T21:08:13.386Z'::timestamptz),
(374,616,'3WrSVq3wACYa3jkbJssjbTqR4C5Emz5JCXABYbJoqGLR','2026-05-17T15:59:32.191Z'::timestamptz),
(375,1968,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-05-18T01:14:21.277Z'::timestamptz),
(376,4301,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-19T03:20:09.840Z'::timestamptz),
(377,4995,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-18T08:26:51.427Z'::timestamptz),
(378,2034,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-05-19T23:00:57.326Z'::timestamptz),
(379,1301,'uisJorf8tmKduAtLkUHcneBfFd28DafQTkf9L2bXU1EV','2026-05-19T03:40:34.708Z'::timestamptz),
(380,11,'WqaAdsEhLfUqEB7JfLi9hmGzJga66TjAwehkutCVugF2','2026-05-21T13:20:33.017Z'::timestamptz),
(381,2179,'2eaZ7LmLeeCYC7KD4BLBaDoM5gLFavZB9tBeP5H64Qse','2026-05-18T04:47:25.480Z'::timestamptz),
(382,3923,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-20T10:38:38.384Z'::timestamptz),
(383,4686,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-05-22T08:39:22.912Z'::timestamptz),
(384,3927,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-05-22T22:25:16.014Z'::timestamptz),
(385,3399,'uQCXFLBWwqMtNjihMyz3pKhjX8Cyk6j1RTkPA5qr4mS4','2026-05-22T11:51:42.786Z'::timestamptz),
(386,3590,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-05-22T21:15:54.007Z'::timestamptz),
(387,3335,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-05-20T10:42:21.435Z'::timestamptz),
(388,1204,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-05-24T02:21:15.534Z'::timestamptz),
(389,758,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-05-24T08:30:10.039Z'::timestamptz),
(390,4408,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-05-24T03:51:52.692Z'::timestamptz),
(391,3616,'UA7w1dZaSabvZrZmbx4k6zm2BuLow9N2cDuvvTP2YpzV','2026-05-23T06:57:28.332Z'::timestamptz),
(392,2298,'EUjBYtJvv35BoNFqnZjdteGDEVYHxr7Pr9KfweDJrpjo','2026-05-24T23:34:49.312Z'::timestamptz),
(393,3583,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-05-22T06:47:49.694Z'::timestamptz),
(394,3326,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-26T08:54:27.505Z'::timestamptz),
(395,4887,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-05-25T16:52:37.583Z'::timestamptz),
(396,3979,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-05-26T09:19:15.443Z'::timestamptz),
(397,2551,'SjFc5xCjunC2GAEsZ7CNhDiAARXBGnTLJghr1W16u6f2','2026-05-27T09:25:21.106Z'::timestamptz),
(398,2831,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-05-26T02:25:03.571Z'::timestamptz),
(399,2282,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-24T14:06:28.677Z'::timestamptz),
(400,4522,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-05-28T08:48:48.951Z'::timestamptz),
(401,4694,'cES5aVzWCozgeT4xPoqg7AsRAcNpsQ459coLeTSkL2L5','2026-05-25T14:42:59.427Z'::timestamptz),
(402,2671,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-05-25T21:59:16.987Z'::timestamptz),
(403,4582,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-05-27T05:55:32.958Z'::timestamptz),
(404,2943,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-05-27T21:51:04.519Z'::timestamptz),
(405,2951,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-05-26T13:17:56.181Z'::timestamptz),
(406,2774,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-29T01:59:43.747Z'::timestamptz),
(407,4669,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-28T11:02:31.491Z'::timestamptz),
(408,3295,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-30T17:28:03.979Z'::timestamptz),
(409,308,'t4Zx18iZgPCKdSNDVEvrzEiytcxSrSyqGkAusFYyVAeT','2026-05-28T18:33:14.725Z'::timestamptz),
(410,2335,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-31T21:34:02.837Z'::timestamptz),
(411,2980,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-31T10:20:44.275Z'::timestamptz),
(412,2284,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-05-30T19:41:18.845Z'::timestamptz),
(413,1578,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-05-31T23:46:23.908Z'::timestamptz),
(414,958,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-05-31T12:47:58.629Z'::timestamptz),
(415,356,'WvKQKspnYcjfqFidTzxsEZsGyGetgyigMg1yJZ7MbDXL','2026-05-31T09:30:43.795Z'::timestamptz),
(416,2812,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-06-03T03:16:41.272Z'::timestamptz),
(417,4191,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-05-30T14:51:26.563Z'::timestamptz),
(418,171,'aj5JfbLsdJWwre7RcmNHisAPkvgou9Tu3KPL5F5gRAoN','2026-06-01T12:06:17.889Z'::timestamptz),
(419,327,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-05-31T23:19:40.906Z'::timestamptz),
(420,2933,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-01T17:46:59.187Z'::timestamptz),
(421,2835,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-06-01T19:21:33.744Z'::timestamptz),
(422,721,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-06-03T08:54:53.511Z'::timestamptz),
(423,4249,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-06-03T08:05:22.241Z'::timestamptz),
(424,4241,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-06-04T14:24:34.510Z'::timestamptz),
(425,1979,'nABDma8ZFrqrJwDQsrfc1wqXPd1xVRxvvhC5G5QPRBve','2026-06-04T08:51:27.458Z'::timestamptz),
(426,1073,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-04T19:59:35.927Z'::timestamptz),
(427,138,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-06-04T05:38:24.357Z'::timestamptz),
(428,4025,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-06-06T12:58:26.545Z'::timestamptz),
(429,4255,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-06T09:55:12.228Z'::timestamptz),
(430,3526,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-07T08:06:08.185Z'::timestamptz),
(431,2382,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-06-06T21:22:57.484Z'::timestamptz),
(432,3925,'NTP9d93FTGRFYKgxnYNiZyxN9xM8REjUVKh9kA15GVRz','2026-06-05T01:48:41.647Z'::timestamptz),
(433,3435,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-06-07T17:07:36.369Z'::timestamptz),
(434,4982,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-06-05T14:14:30.184Z'::timestamptz),
(435,355,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-06-07T23:57:05.079Z'::timestamptz),
(436,2032,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-06-10T03:14:38.753Z'::timestamptz),
(437,3856,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-06-07T20:40:47.031Z'::timestamptz),
(438,244,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-06-07T03:25:25.264Z'::timestamptz),
(439,1359,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-06-09T15:08:43.150Z'::timestamptz),
(440,2802,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-06-11T11:11:33.848Z'::timestamptz),
(441,3946,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-09T10:05:00.816Z'::timestamptz),
(442,4908,'k9NHpDyWT7aki8UgXLKkMzSqrEzjXeVJHPdfGyH5a4mV','2026-06-10T11:36:38.461Z'::timestamptz),
(443,987,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-06-10T00:17:23.069Z'::timestamptz),
(444,4192,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-06-10T22:42:45.996Z'::timestamptz),
(445,4483,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-06-10T03:53:14.522Z'::timestamptz),
(446,2827,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-12T03:16:05.951Z'::timestamptz),
(447,687,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-06-12T11:01:53.181Z'::timestamptz),
(448,1069,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-06-12T00:54:09.765Z'::timestamptz),
(449,4212,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-06-11T08:41:25.029Z'::timestamptz),
(450,625,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-06-12T00:08:03.827Z'::timestamptz),
(451,4673,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-06-14T05:15:48.294Z'::timestamptz),
(452,2863,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-06-15T19:12:07.370Z'::timestamptz),
(453,4968,'97C6BD8uKT5UecxptgoWex9TwhPng2BpXgyEbE5mDNFy','2026-06-12T16:03:54.380Z'::timestamptz),
(454,1536,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-06-16T10:31:18.398Z'::timestamptz),
(455,1947,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-06-16T14:42:52.495Z'::timestamptz),
(456,4524,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-06-14T07:02:04.553Z'::timestamptz),
(457,155,'sRMVnGH4joMw6SCMfEwDhEzSQn3F3DkaCwVmTbe8CQEh','2026-06-14T19:57:35.263Z'::timestamptz),
(458,1696,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-06-14T13:32:26.074Z'::timestamptz),
(459,4165,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-06-16T04:34:19.686Z'::timestamptz),
(460,3057,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-06-17T10:28:45.646Z'::timestamptz),
(461,3005,'ZbNYx3vx4WSXdSCXao7FgSPiETd3b62YFmv3msR3HisA','2026-06-16T12:04:48.153Z'::timestamptz),
(462,2662,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-06-15T16:38:41.581Z'::timestamptz),
(463,3827,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-06-19T14:02:25.657Z'::timestamptz),
(464,1206,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-06-17T07:01:19.789Z'::timestamptz),
(465,2578,'jjaN7AxhZAXmrvAjrjWQcXinvqtJvVDMFBTAvQSMvEKB','2026-06-18T18:33:30.604Z'::timestamptz),
(466,3318,'TVFsuG35TCjWF3q6QkwYqZi1VUW7aLFZcvxERH6GbNPi','2026-06-20T06:00:13.413Z'::timestamptz),
(467,4575,'uisJorf8tmKduAtLkUHcneBfFd28DafQTkf9L2bXU1EV','2026-06-19T20:08:36.380Z'::timestamptz),
(468,4645,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-06-19T03:13:50.549Z'::timestamptz),
(469,1782,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-06-19T22:51:00.582Z'::timestamptz),
(470,3943,'jjaN7AxhZAXmrvAjrjWQcXinvqtJvVDMFBTAvQSMvEKB','2026-06-20T01:21:19.950Z'::timestamptz),
(471,2627,'7jZ8V9chpen3p5waHRAFz8wBEAe5enjqaPHSNmD8bNka','2026-06-20T11:26:47.647Z'::timestamptz),
(472,4261,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-06-22T12:09:14.639Z'::timestamptz),
(473,4821,'UA7w1dZaSabvZrZmbx4k6zm2BuLow9N2cDuvvTP2YpzV','2026-06-20T23:39:46.884Z'::timestamptz),
(474,3779,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-06-21T15:16:01.679Z'::timestamptz),
(475,3371,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-06-20T22:29:13.848Z'::timestamptz),
(476,14,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-22T13:43:50.873Z'::timestamptz),
(477,3365,'ZbNYx3vx4WSXdSCXao7FgSPiETd3b62YFmv3msR3HisA','2026-06-22T01:14:26.092Z'::timestamptz),
(478,274,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-06-23T11:20:36.383Z'::timestamptz),
(479,2391,'UA7w1dZaSabvZrZmbx4k6zm2BuLow9N2cDuvvTP2YpzV','2026-06-21T21:55:46.237Z'::timestamptz),
(480,2682,'UULKeR8k6j1yGZpa6aBYJo9FNQjQ5xFX78xiEn4RHuya','2026-06-23T12:46:53.089Z'::timestamptz),
(481,766,'nVdrPN1x9sJDws1UwwHXSmSxDen32CfnYpr1svigsQHL','2026-06-23T21:35:21.193Z'::timestamptz),
(482,728,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-06-22T19:34:52.157Z'::timestamptz),
(483,4206,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-06-24T20:01:27.147Z'::timestamptz),
(484,4978,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-06-26T23:41:18.418Z'::timestamptz),
(485,3242,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-06-24T11:11:24.658Z'::timestamptz),
(486,2840,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-06-26T16:44:14.505Z'::timestamptz),
(487,920,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-06-25T00:27:34.147Z'::timestamptz),
(488,39,'EcUf8HcSwQwEYYzYNmJjRFXKw1d1nZFkWKRbviHASHkB','2026-06-27T23:10:41.928Z'::timestamptz),
(489,330,'DWcHzMf1wZ7V9qWfdLp8fiiG2b81AncqwbJUdvTmN1JY','2026-06-25T02:41:26.864Z'::timestamptz),
(490,2908,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-06-28T14:39:11.131Z'::timestamptz),
(491,2102,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-06-27T04:27:25.561Z'::timestamptz),
(492,2441,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-06-28T05:03:51.073Z'::timestamptz),
(493,2173,'36LyTsbPoxuafWNtBvyyJ44iEv6U5Gv1Q2q2pwdRRKZD','2026-06-29T20:20:22.038Z'::timestamptz),
(494,792,'wJTFjs2Wm4R2sejeRCRoYkpPxiEcELeUu9jQhNedevQR','2026-06-29T04:33:04.078Z'::timestamptz),
(495,4061,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-06-29T19:55:23.416Z'::timestamptz),
(496,3832,'g66VHjXcbpF7wAwkuMKcRSBWDgpzVW5x5KpXsAMP1dsr','2026-06-30T19:13:05.243Z'::timestamptz),
(497,2045,'cZFSA3twdYjiSYd2WAY82cHv4WG4br4G92AUu5MwzqyS','2026-06-30T10:31:19.257Z'::timestamptz),
(498,3932,'VQxbQ3TDHkMygGmtZ3qaNuDfvWQTp2S4h7v9p7J97Tbb','2026-06-30T00:12:32.384Z'::timestamptz),
(499,4043,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-06-30T12:55:06.478Z'::timestamptz),
(500,1513,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-07-01T13:45:25.874Z'::timestamptz),
(501,4626,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-06-29T09:10:22.706Z'::timestamptz),
(502,1538,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-06-30T19:26:20.527Z'::timestamptz),
(503,100,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-07-02T12:21:14.679Z'::timestamptz),
(504,386,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-07-03T18:35:54.110Z'::timestamptz),
(505,4932,'7QJX18yNi2EPhfiT9hT295V2hqA3FQ46zGvm3nM1YGDy','2026-07-02T01:39:56.841Z'::timestamptz),
(506,2505,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-07-01T04:11:07.287Z'::timestamptz),
(507,1019,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-07-03T23:08:36.077Z'::timestamptz),
(508,2820,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-07-04T05:32:16.214Z'::timestamptz),
(509,334,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-07-03T14:49:52.539Z'::timestamptz),
(510,2570,'Ki7sGTgPfaTWWVPhnmSQypacnQqfX36uYk81in7Mmnih','2026-07-02T20:51:15.847Z'::timestamptz),
(511,2434,'JXh99dYPCupQ4xMPkzFkFCUjWmfYv6RuKJy3NP42H4G1','2026-07-04T05:48:13.644Z'::timestamptz);

-- The seed's own view of the permutation, checked against the permutation. If
-- these disagree the generator and the reveal table were produced from different
-- runs, and the crew the app renders is not the crew this database thinks exists.
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
    from genesis_crew g
    join public.reveal_order r on r.draw_position = g.draw_position
   where r.serial <> g.serial;
  if v_bad > 0 then
    raise exception '% genesis positions disagree with the reveal permutation', v_bad;
  end if;

  select count(*) into v_bad from genesis_crew;
  if v_bad <> 512 then
    raise exception 'genesis crew is % xployees, expected 512 (HIRED_COUNT)', v_bad;
  end if;
end;
$$;

-- Take the positions out of the pool.
update public.reveal_order r
   set claimed_by = g.owner,
       claimed_at = g.hired_at,
       claim_kind = 'genesis'
  from genesis_crew g
 where r.draw_position = g.draw_position;

-- And write the ownership. The stamping trigger moves `updated_at` for us; the
-- tier, skill count and principal are already correct from the seed and are not
-- restated, so this statement cannot contradict them.
update public.xployees x
   set owner     = g.owner,
       hired_at  = g.hired_at
  from genesis_crew g
 where x.id = g.serial;

-- ---------------------------------------------------------------------------
-- What the xNET now guarantees
-- ---------------------------------------------------------------------------
do $$
declare
  v_owned    integer;
  v_wallets  integer;
  v_pool     integer;
  v_next     integer;
begin
  select count(*) into v_owned from public.xployees where owner is not null;
  if v_owned <> 512 then
    raise exception '% xployees are owned, expected exactly the 512 genesis workers', v_owned;
  end if;

  select count(*) into v_wallets from public.wallets;
  if v_wallets <> 97 then
    raise exception 'the xNET seeded % wallets, expected 97', v_wallets;
  end if;

  -- Every genesis worker's owner is a wallet the directory can name. Not a
  -- foreign key on the table — a real mint must not require a profile row — but
  -- true of the seeded partition, and worth knowing it is.
  if exists (
    select 1 from public.xployees x
     where x.owner is not null
       and not exists (select 1 from public.wallets w where w.address = x.owner)
  ) then
    raise exception 'a genesis xployee is owned by a wallet the directory does not know';
  end if;

  -- Owned and unclaimed are the same set seen from two tables. A serial owned by
  -- somebody while its reveal position sits in the pool would be dealt again to
  -- the next buyer.
  if exists (
    select 1 from public.xployees x
     join public.reveal_order r on r.serial = x.id
    where (x.owner is not null) <> (r.claimed_at is not null)
  ) then
    raise exception 'ownership and the reveal pool disagree about at least one serial';
  end if;

  select count(*) into v_pool from public.reveal_order where claimed_at is null;
  if v_pool <> public.max_supply() - 512 then
    raise exception 'the mint pool holds % positions, expected %', v_pool, public.max_supply() - 512;
  end if;

  -- The first serial a real mint will be dealt. Stated out loud because it is the
  -- one number a reader can check by hand against `serialForMint(512)` in the
  -- browser, and because getting it wrong means the first buyer receives a worker
  -- somebody else is already looking at.
  select serial into v_next from public.reveal_order where claimed_at is null order by draw_position limit 1;
  if v_next <> 4228 then
    raise exception 'the next mint would be dealt serial %, but position 512 of the permutation is 4228', v_next;
  end if;
end;
$$;

-- Genesis hires are not mints, and this says so where a reader will trip over it.
comment on column public.reveal_order.claim_kind is
  'genesis = one of the 512 pre-hired workers the collection ships with; nobody burned for these and public.mints holds no row for them. reserved = held by a live mint reservation. minted = burned for, verified on chain, assigned.';

comment on column public.xployees.owner is
  'Null means UNMINTED, not unknown. Every serial exists from the seed; minting moves this from null to a wallet. Count mints in public.mints, not owners here — the 512 genesis workers are owned and were never minted.';
