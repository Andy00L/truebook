# TrueBook: build plan (hackathon TxODDS, track Prediction Markets and Settlement)

Statut: plan approuve le 2 juillet 2026. Build sur devnet. Deadline 19 juillet 2026 23:59 UTC.
Recherche detaillee: `docs/research/2026-07-02-recherche-idees-soumission.md`.

## Contexte

Soumission au track "Prediction Markets and Settlement" du hackathon TxODDS World Cup (Superteam Earn). 1er prix 12 000 USDT, 12+ concurrents.

Le produit: **TrueBook, le sportsbook on-chain qui ne peut pas mentir sur ses prix.** Un vault maison cote tous les matchs restants de la Coupe du Monde au prix consensus StablePrice de TxLINE plus une marge fixe affichee. Chaque prix servi reference l'enregistrement de cote ancre on-chain (Merkle) par TxODDS; n'importe qui peut prouver a posteriori, via `validate_odds`, que le prix du ticket respectait le consensus. Le settlement des issues passe par `validate_stat` (preuves de score Merkle).

Insight differenciant: le programme TxLINE devnet contient deja un exchange P2P (create_intent, settle_trade); les concurrents vont le cloner. Personne n'utilisera la moitie "cotes" du stack de verification: c'est notre terrain.

## Decisions actees

- Reseau: devnet. Programme TxLINE `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`, API `https://txline-dev.txodds.com/api/`, USDT test `ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh`, faucet `request_devnet_faucet`, tier 1 gratuit World Cup (delai 60 s).
- Style UI: broadcast sombre (detail plus bas).
- Liquidite: vault operateur seul (pas de LP publics).
- Langue UI: anglais.
- Marches drama phases finales (prolongation, tirs au but): stretch goal si core fini a J+12.

## Flux utilisateur

1. **Parier.** Lobby des matchs restants (8es au 7/7, quarts 9-11/7, demies 14-15/7, finale 19/7). Sur une page match, chaque marche affiche la cote maison en transparence totale: "StablePrice consensus 2.10, marge 2 %, votre cote 2.06". L'utilisateur connecte son wallet, prend son USDT devnet au faucet integre, place sa mise. Le ticket on-chain contient la cote, le `messageId` et le `ts` de l'enregistrement StablePrice source.
2. **Verifier le resultat.** Apres le match, un keeper permissionless soumet la preuve de score: une transaction par marche fait le CPI dans `validate_stat` et ecrit un PDA `VerifiedOutcome`. Les payouts deviennent des claims legers. Chaque ticket affiche son recu de resolution (racine du jour, chemin Merkle, lien transaction).
3. **Auditer le prix (bouton signature).** "Audit this price" prouve via `validate_odds` que la cote consensus au moment du pari etait bien celle referencee et que le prix servi ne deviait pas au-dela de la marge annoncee. Violation prouvee: le ticket devient remboursable on-chain, meme perdant. La maison est punie par le code, pas par la confiance.
4. **Mode replay.** Rejoue un match termine via `/api/scores/historical/{fixtureId}`: scores qui defilent, cotes qui bougent, settlement qui se declenche. Moteur de la video demo et du test des juges apres la fin du tournoi.

## Architecture (monorepo Bun workspaces)

```
truebook/
  program/            Anchor (Rust): le programme truebook
  app/                Next.js App Router (bunx create-next-app@latest --ts --app --use-bun)
  keeper/             Bot TypeScript (Bun): markets, quotes, lock, verify, settle
  packages/shared/    Client TxLINE (auth JWT + X-Api-Token, SSE, proofs), types partages, IDLs
  docs/               architecture, doc de soumission, feedback API TxLINE
```

## Programme Anchor: spec

Tous les marches sont binaires YES/NO sur un predicat TxLINE (`stat_a [op stat_b] comparaison threshold`), le langage natif de `validate_stat`. Le 1X2 est un groupe de 3 marches binaires cote UI.

Exemples d'encodage (stats par equipe et par periode; cle = periode * 1000 + base; base 1 = buts P1, etc. A confirmer au spike J1):
- Victoire equipe A: goals_P1 Subtract goals_P2 GreaterThan 0 (periode Total)
- Nul: Subtract EqualTo 0. Over 2.5 buts: goals_P1 Add goals_P2 GreaterThan 2
- Corners 2e MT over 4.5: corners_P1 Add corners_P2 GreaterThan 4 (periode H2)
- Stretch drama: "va en prolongation" / "decide aux tirs au but" via stats ET1/PE

### Comptes (PDAs)

- `House` ["house"]: authority, usdt_mint, vault ATA, margin_bps (200), max_exposure_per_market, max_payout_per_ticket, paused, totaux agreges.
- `Market` ["market", fixture_id, params_hash]: fixture_id i64, params (periode, stat keys, op, comparaison, threshold), kickoff_ts, state (Open, Locked, Verified, Settled, Voided), quote courante (yes_odds_bps, no_odds_bps u32, odds_message_id, odds_ts, quote_posted_ts), exposition par cote.
- `Ticket` ["ticket", market, bettor, nonce]: side, stake, quoted_odds_bps, odds_message_id, odds_ts, potential_payout, state (Live, Won, Lost, Claimed, Refundable, Refunded), audit_status (Unaudited, Honest, Violation).
- `VerifiedOutcome` ["outcome", market]: outcome bool, seq, verified_at.

Cotes en basis points de cote decimale (2.06 = 20600); payout = stake * odds_bps / 10000 en u128 checked. Marge: p_house = p_consensus_demargined * (1 + margin_bps/10000), cote = 1/p_house.

### Instructions

1. `initialize_house(margin_bps, caps)` (authority)
2. `deposit_liquidity` / `withdraw_liquidity` (authority seul; retrait bloque sous l'exposition ouverte)
3. `create_market(fixture_id, params, kickoff_ts)` (authority/keeper)
4. `post_quote(market, yes_odds_bps, no_odds_bps, odds_message_id, odds_ts)` (keeper): provenance du prix on-chain AVANT le pari; validite 120 s
5. `place_bet(market, side, stake)`: exige quote fraiche, marche Open, kickoff futur, caps d'exposition respectes (payout potentiel <= vault disponible); transfert USDT vers vault; snapshot de la quote dans le Ticket
6. `lock_market` (kickoff atteint, permissionless)
7. `verify_market(ts, fixture_summary, fixture_proof, main_tree_proof, stat_a, stat_b?, ...)`: permissionless; CPI `validate_stat` (budget 1.4M CU demande, logique locale minimale); ecrit VerifiedOutcome. Plan B mesure au spike J1: verification Merkle native en lisant le PDA `daily_scores_roots` directement (pas de CPI)
8. `settle_ticket`: apres VerifiedOutcome; Won paie depuis le vault, Lost reste au vault; crank permissionless, idempotent
9. `void_market` + `refund_ticket`: annulation ou issue improuvable 48 h apres le match; remboursement integral
10. `audit_ticket(ts, odds_snapshot, summary, sub_tree_proof, main_tree_proof)`: permissionless; CPI `validate_odds` authentifie l'enregistrement de cote (messageId, ts) reference par le ticket; le programme recompare implied prob servie vs consensus + marge + tolerance; si violation: audit_status = Violation et ticket -> Refundable. Emet TicketAudited

### Qualite et securite (REFERENCE_SECURITY_AUDIT: audit complet obligatoire avant soumission, trust boundary argent)

- Math checked partout, zero unwrap hors tests, erreurs distinctes et actionnables par code d'erreur Anchor
- Events: MarketCreated, QuotePosted, BetPlaced, MarketLocked, MarketVerified, TicketSettled, TicketAudited, MarketVoided
- Chemins de fuite couverts: quote perimee, marche verrouille, double settlement, double claim, vault insuffisant, preuve d'un autre fixture, periode mismatch, refund apres void

## Keeper (Bun + TypeScript)

- Auth TxLINE: `POST /auth/guest/start` (JWT) puis `POST /api/token/activate` (signature NaCl du message `${txSig}:${leagues}:${jwt}` avec keypair locale, tier devnet 1 gratuit). Note quickstart: le subscribe on-chain reste requis meme sur le tier gratuit (a confirmer au spike).
- Jobs: sync fixtures (cree les marches de tous les matchs restants); refresh quotes depuis SSE `/api/odds/stream` (fallback snapshot 5 min) -> `post_quote`; `lock_market` au kickoff; post-match: `GET /api/scores/stat-validation?fixtureId=&seq=&statKey=...` -> `verify_market` -> boucle `settle_ticket`; prechargement des payloads `GET /api/odds/validation` pour l'audit en un clic
- Resilience: reconnexion SSE via Last-Event-ID, backoff exponentiel borne, cranks idempotents, logs prefixes [FunctionName], zero secret logge

## Frontend (Next.js App Router + Bun, Tailwind + shadcn/ui, wallet-adapter)

### Pages

- `/` Lobby: matchs restants avec badge live, marches vedettes, bandeau house (vault, exposition, marge affichee, "every price is auditable")
- `/match/[fixtureId]`: header score live (minute, periode), grille de marches (1X2, totals, corners, cartons, par mi-temps), popover de transparence prix (consensus vs cote servie vs marge), bet slip en drawer
- `/tickets`: mes tickets avec deux recus chacun: recu de resolution (chemin Merkle anime vers la racine du jour, lien explorer) et audit de prix (resultat `validate_odds` en simulation `.view()` instantanee cote client, plus transaction d'audit permanente optionnelle)
- `/verify/[market]`: page publique de resolution verifiable, partageable
- `/replay`: rejoue un match termine (timeline des updates historiques, quotes et settlement rejoues)
- Mode juge: bouton faucet USDT devnet (CPI `request_devnet_faucet` du programme TxLINE) + lien airdrop SOL

### Style UI: "broadcast sombre"

- Fond graphite quasi noir (base ~#0B0E11), surfaces en cartes #12161B, bordures 1 px #1E242B
- Un seul accent: vert scoreboard (~#00E676) pour les cotes, etats positifs et le live; rouge sobre (~#FF5252) reserve aux baisses de cote et pertes; jamais les deux en decor
- Chiffres en mono a espacement tabulaire (Geist Mono ou JetBrains Mono) pour cotes, scores, hashs; texte en Inter/Geist Sans
- Ticks de cotes: flash vert/rouge 300 ms au changement, facon terminal de trading
- Recus de preuve stylises comme des bet slips imprimes: fond legerement plus clair, bord perfore, lignes de hash en mono tronque avec copie au clic, tampon "VERIFIED ON SOLANA" au settlement
- Densite type workstation: tableaux compacts, hierarchie par taille de chiffre et non par couleur, badges d'etat discrets
- Skill `frontend-design-guidelines` a charger pendant le build du front; formats de nombres via `number-formatting` (cotes 2 decimales, implied % 1 decimale, USDT 2 decimales)

## Plan de build (17 jours, du 2 au 19 juillet)

- J1-J2: spikes bloquants puis scaffold. Spike 1: recuperer une preuve stat-validation d'un match World Cup termine sur l'API devnet et executer `validateStat` en `.view()`. Spike 2: mesurer le compute reel d'un CPI `validate_stat` depuis un programme jouet (decide CPI vs verification Merkle native). Spike 3: payload `validate_odds` de bout en bout. Puis scaffold monorepo.
- J3-J6: programme complet + tests Anchor sur localnet avec `solana-test-validator --clone` du programme TxLINE et des PDAs de racines depuis devnet (tests deterministes contre de vraies racines).
- J7-J9: keeper de bout en bout sur devnet pendant les quarts de finale (9-11 juillet, vrais matchs).
- J10-J13: frontend complet + recus + replay + mode juge.
- J14-J15: audit de securite complet (procedure REFERENCE_SECURITY_AUDIT phases 0-9), stretch marches drama si core fini, polish.
- J16-J17: video demo 5 min (captures live pendant les demi-finales 14-15/7 + replay), doc technique, feedback API TxLINE, soumission le 18 (buffer 24 h avant deadline).

## Verification

- Programme: suite anchor test sur localnet clone (place/lock/verify/settle/void/audit, chemins d'erreur inclus), puis scenario reel devnet sur un match des 8es.
- Keeper: run continu 24 h sur devnet, verifier reconnexions SSE et idempotence des cranks.
- Front: parcours complet pari -> settlement -> audit en preview local, puis sur le deploiement.
- Fin de tache systematique: greps du final check SKILL_GENERAL (tirets longs, suppressions de type, mots bannis), build vert, rapport de fichiers affectes, bloc git handoff.

## Actions reservees a l'humain (jamais par l'agent)

- Toute commande git (init, add, commit, push): blocs handoff fournis a chaque etape.
- Deploiements externes: `anchor deploy` sur devnet et deploiement du front (Vercel). L'agent prepare tout et demande une autorisation explicite a chaque deploiement, ou une autorisation permanente donnee en debut de build.
- La soumission finale sur Superteam Earn.
