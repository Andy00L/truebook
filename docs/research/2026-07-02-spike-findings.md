# Spike findings: validation technique TxLINE devnet (2 juillet 2026)

Les trois spikes bloquants du plan sont verts. L'architecture TrueBook est validee de bout en bout sur devnet avec de vraies preuves. Sonde: `.scratch/spike1.ts` (jetable, gitignore).

## Resultat: les 3 primitives fonctionnent sur devnet

| Spike | Question | Resultat |
|-------|----------|----------|
| 1 | Les preuves de score soccer existent-elles sur devnet et validate_stat rend-il le bon resultat ? | OUI. USA 2-0 Bosnie: (P1-P2)>0 rend true, <0 rend false, P1>1 rend true |
| 2 | Cout compute d'une validation (viabilite CPI) ? | ~150k CU (scores), ~179k CU (odds). Limite tx = 1.4M CU. CPI largement viable |
| 3 | validate_odds authentifie-t-il un enregistrement StablePrice ? | OUI. 1X2 StablePriceDemargined authentifie, rend true, ~179k CU |

Consequence: le risque n1 identifie en recherche (le README public tx-on-chain ne documente que le college US, pas le soccer) est ecarte. Les stats soccer (buts, corners, cartons par periode) sont bien ancrees et prouvables sur devnet aujourd'hui.

## Faits techniques verifies (a implementer tels quels)

### Auth devnet (flux complet valide)
1. `POST https://txline-dev.txodds.com/auth/guest/start` rend `{ token }` (JWT invite).
2. Creer l'ATA TxL de l'utilisateur (Token-2022) AVANT subscribe, sinon AnchorError 3012 AccountNotInitialized. Idempotent.
3. `subscribe(service_level_id=1, weeks=4)` on-chain (tier World Cup gratuit, 0 TxL). PDAs: pricing_matrix, token_treasury_v2, ATA treasury Token-2022.
4. Signer `${txSig}:${leagues}:${jwt}` en NaCl detached, base64.
5. `POST /api/token/activate` body `{ txSig, walletSignature, leagues }` header Bearer JWT. Reponse: token en TEXTE BRUT `txoracle_api_<hex>` (pas du JSON).
6. Requetes data: headers `Authorization: Bearer <jwt>` + `X-Api-Token: <apiToken>`.

### Piege bloquant 1: le token API est du texte brut
`/api/token/activate` renvoie le token nu, pas `{ apiToken }`. Parser en texte, verifier le prefixe `txoracle_api_`.

### Piege bloquant 2 (le plus important): ts = minTimestamp
`validate_stat` et `validate_odds` prennent en 1er argument `ts`. Ce ts DOIT etre `summary.updateStats.minTimestamp`, PAS le `ts` top-level de la reponse ni `maxTimestamp`. Sinon: erreur custom 6010 TimestampMismatch. Le meme minTimestamp sert a deriver l'epochDay du PDA. La majorite des concurrents va se tromper ici.

### Piege 3: renommage de champ eventStatsSubTreeRoot
L'API renvoie `summary.eventStatsSubTreeRoot`; l'arg IDL attend `eventsSubTreeRoot` (ScoresBatchSummary.events_sub_tree_root). Renommer au mapping. Cote odds, l'API donne `summary.oddsSubTreeRoot` = IDL `odds_sub_tree_root` (coherent).

### Piege 4: zstd sur fetch Bun
TxLINE sert du zstd que le fetch de Bun echoue a decoder (ZstdDecompressionError). Forcer `Accept-Encoding: identity` sur les appels JSON (ou gzip). A gerer dans le client du package shared.

### Piege 5: validate_stat/validate_odds ne sont pas des views IDL
L'IDL declare `returns: null`, donc `.view()` d'Anchor ne marche pas. Mais le programme ecrit un return data (set_return_data) d'1 octet booleen. Le lire via simulateTransaction (`value.returnData`) cote client, ou via `get_return_data` apres un CPI cote programme. C'est ce qui permet de connaitre l'issue (YES vs NO), pas seulement succes/echec.

### PDAs de racines (existent, ~9232 octets, plein de slots 5 min)
- Scores: `["daily_scores_roots", epochDay u16 LE]`, arg account `dailyScoresMerkleRoots`.
- Odds: `["daily_batch_roots", epochDay u16 LE]`, arg account `dailyOddsMerkleRoots`.
- epochDay = floor(minTimestamp / 86_400_000).

### Format des preuves scores (stat-validation)
`GET /api/scores/stat-validation?fixtureId=&seq=&statKey=&statKey2=`. Reponse: `ts, statToProve{key,value,period}, statToProve2, eventStatRoot[32], summary{fixtureId, updateStats{updateCount,minTimestamp,maxTimestamp}, eventStatsSubTreeRoot[32]}, statProof[], statProof2[], subTreeProof[], mainTreeProof[]`. Les deux stats partagent le meme eventStatRoot.
- Encodage stat verifie: `key=1` = buts Participant1, `key=2` = buts Participant2, `period=0` = Total. La snapshot expose Score par periode (H1, HT, H2, Total) avec Goals, Corners, YellowCards, RedCards.
- validate_stat calcule `(stat_a op stat_b) comparaison threshold` et rend le booleen. Op: Add/Subtract. Comparison: GreaterThan/LessThan/EqualTo.

### Format des cotes (le coeur de TrueBook)
`GET /api/odds/updates/{fixtureId}` et SSE `/api/odds/stream`. Enregistrement:
`FixtureId, MessageId ("1835117386:00003:000156-10021-stab"), Ts, Bookmaker ("TXLineStablePriceDemargined"), BookmakerId (10021), SuperOddsType, GameState, InRunning, MarketParameters ("line=2.5"), MarketPeriod ("half=1"), PriceNames (["part1","draw","part2"]), Prices ([1613,4157,7175]), Pct (["...","...","..."])`.
- Prices = cotes decimales x1000 (1613 = 1.613). Le feed Demargined donne deja la probabilite juste (Pct somme ~100 %). TrueBook lit ce prix juste et ajoute sa marge affichee par-dessus.
- SuperOddsType vus: `1X2_PARTICIPANT_RESULT`, `OVERUNDER_PARTICIPANT_GOALS` (avec MarketParameters `line=2.5`).
- `GET /api/odds/validation?messageId=&ts=` rend `{ odds, summary{...,oddsSubTreeRoot}, subTreeProof, mainTreeProof }` pour l'audit.

### Snapshot vs historical
- `GET /api/scores/snapshot/{fixtureId}` = tableau JSON (Score cumule courant par periode, dernier Seq).
- `GET /api/scores/historical/{fixtureId}` = flux SSE (`data: {...}\nid: N`), pas du JSON. Parser en SSE pour le mode replay.
- Le dataset devnet est un jeu de test (Vietnam vs Myanmar, etc.), pas les vrais matchs. Pour la demo: utiliser ces fixtures de test + replay historique.

## Etat de l'environnement
- WSL: bun 1.3.14, rustc 1.96.1, solana-cli 4.0.2 (Agave), anchor-cli 0.31.1.
- Keypair devnet existant `8Safo...Je5P` (~2 SOL) utilise pour financer le keypair jetable de la sonde (faucet public devnet en rate-limit).

## Impact sur l'architecture
- `verify_market`: CPI validate_stat, lire le return data booleen, ecrire VerifiedOutcome{outcome}. Confirme viable (~150k CU + overhead CPI, loin de 1.4M).
- `audit_ticket`: CPI validate_odds pour authentifier (messageId, ts) du ticket, puis comparer prob servie vs prob StablePrice + marge. Confirme viable.
- Client shared: gerer texte brut du token, Accept-Encoding identity, mapping minTimestamp/eventsSubTreeRoot, parsing SSE.
