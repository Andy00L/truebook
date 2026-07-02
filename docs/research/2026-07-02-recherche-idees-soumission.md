# Recherche et idees de soumission: track Prediction Markets and Settlement (TxODDS World Cup)

Date: 2 juillet 2026. Decision actee: build sur devnet. Deadline: 19 juillet 2026, 23:59 UTC.

## 1. Faits techniques etablis (docs TxLINE lues en entier)

### Reseau devnet
- Programme: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` (v1.5.2)
- API: `https://txline-dev.txodds.com/api/`
- USDT de test: `ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh`
- Faucet USDT integre au programme: instruction `request_devnet_faucet` (les juges peuvent se financer seuls)
- Tier devnet unique: ID 1, gratuit, World Cup + amicaux internationaux, delai 60 s, scores + cotes StablePrice

### Donnees et preuves
- Hierarchie Merkle a 3 niveaux: racine de batch on-chain -> sous-arbre par fixture -> sous-arbre par evenement de score -> stats individuelles
- Racines publiees toutes les 5 minutes (scores et cotes), fixtures par lot de 10 jours (source: repo GitHub txodds/tx-on-chain et instructions insert_scores_root/insert_batch_root)
- PDAs: `daily_scores_roots` + jour epoch (u16 LE), `daily_batch_roots` (cotes), `ten_daily_fixtures_roots`
- Stats soccer ancrees par equipe et par periode: Goals, YellowCards, RedCards, Corners. Periodes: H1, HT, H2, ET1, ET2, PE (tirs au but), ETTotal, Total. Encodage cle: periode * 1000 + cle de base (ex. 1 = Participant1_Score, 1001 = buts 1re MT)
- Endpoint de preuve: `GET /api/scores/stat-validation?fixtureId=&seq=&statKey=` (mode legacy 1-2 stats) ou `statKeys=` (mode V2, preuves N-dimensionnelles)
- Preuves de cotes: `GET /api/odds/validation?messageId=&ts=` (chaque cote StablePrice est prouvable on-chain a posteriori)
- Replay historique: `GET /api/scores/historical/{fixtureId}` (fenetres de 6 h a 2 semaines dans le passe), sequence complete des updates: mode demo/replay fourni par l'API elle-meme
- Streams SSE: `/api/odds/stream` et `/api/scores/stream` (filtre fixtureId, reprise via Last-Event-ID, gzip conseille)

### Instructions du programme TxLINE (devnet, 47 au total)
- Validation (view, retour bool): `validate_stat` (predicat threshold + GreaterThan/LessThan/EqualTo sur 1 stat, ou 2 stats avec Add/Subtract), `validate_odds`, `validate_fixture`. Budget compute a prevoir: jusqu'a 1 400 000 CU
- Le programme TxLINE embarque deja un exchange P2P complet: `create_intent`, `execute_match` (solver), `settle_trade`, `settle_matched_trade`, `claim_via_resolution` (racines de resolution publiees par TxODDS), `audit_trade_result`
- Consequence directe: re-implementer un escrow P2P 1X2 qui settle via validate_stat revient a cloner le settle_trade que les juges ont eux-memes ecrit. C'est le piege dans lequel la majorite des 12+ soumissions va tomber

### Contraintes
- Token TxL interdit pour le wagering (uniquement acces data). Paris en USDT/USDC de test sur devnet
- Delai 60 s sur devnet: acceptable pour du settlement post-match et des marches par periode, a signaler pour l'in-play
- Le compute de validate_stat impose le pattern "verifier une fois, payer N fois": une transaction de verification ecrit un PDA VerifiedOutcome par marche, puis les claims sont legers

## 2. Calendrier des matchs restants (fenetre de build)

Source: FIFA, Wikipedia, CBS Sports (confirme le 2 juillet 2026).
- 16es de finale: jusqu'au 3 juillet
- 8es de finale: 4 au 7 juillet
- Quarts: 9 au 11 juillet
- Demi-finales: 14 et 15 juillet
- Match pour la 3e place: 18 juillet
- Finale: 19 juillet, MetLife Stadium (jour de la deadline)

Environ 16 vrais matchs pendant la fenetre de build, tous a elimination directe (prolongations et tirs au but possibles, et les stats ET1/ET2/PE sont ancrees).

## 3. Patterns de gagnants et signaux concurrentiels

Avertissement de methode: la passe de verification adversariale du deep-research a echoue (limite de session API), ces claims sont cites mais non contre-verifies.
- Colosseum indique que la video de pitch est l'element le plus important d'une soumission et privilegie la narration sur la production (blog.colosseum.com/perfecting-your-hackathon-submission)
- Precedents de projets paris/prediction gagnants: Pregame (1er track Consumer, Radar, 30 000 USD), Trepa (1er track Consumer, Breakout 2025), Melee Markets (2e), DisBet (gagnant du track Sports Betting UX de Sandstorm: un bot Discord solo au-dessus de Monaco Protocol, prime au concept et au design plutot qu'a la profondeur technique, dixit le CEO de BetDEX)
- Frontier top 25: les projets marches gagnants avaient une structure de marche originale, pas un sportsbook generique
- pm-AMM (Paradigm, nov. 2024): le papier avertit explicitement que le foot colle mal a son modele gaussien (l'information arrive par sauts de buts). Porter naivement pm-AMM sur du foot contredit le papier; choisir un mecanisme tolerant aux sauts est un angle defendable
- DPM de Pennock (ACM EC 2004): parimutuel dynamique, liquidite garantie, zero risque pour l'operateur, prix continus en forme fermee (implementable en Rust). Quasi absent de la production sports en 2026
- 12 soumissions au 1er juillet sur ce track, le plus concurrentiel des trois

## 4. Les 3 idees de soumission

### Idee 1 (recommandee): TrueBook, le sportsbook qui ne peut pas mentir sur ses prix
- Probleme: tout sportsbook (centralise ou crypto) peut biaiser ses cotes; l'utilisateur n'a aucun moyen d'auditer le prix qu'on lui a servi. TxLINE ancre le consensus mondial des cotes toutes les 5 minutes: on peut donc construire le premier bookmaker dont chaque prix servi est verifiable a posteriori contre un consensus neutre ancre on-chain.
- Mecanisme: un vault LP en USDT devnet fait office de maison et cote tous les matchs restants a StablePrice + marge fixe et affichee (ex. 2 %). Chaque ticket enregistre le messageId et le ts de la cote source. Regle d'honnetete on-chain: si un audit validate_odds prouve que le prix servi deviait du consensus au-dela de la marge annoncee, le ticket devient remboursable.
- Settlement: keeper bot ecoute le SSE; a la fin du match, une transaction verifie l'issue via CPI validate_stat et ecrit un PDA VerifiedOutcome; les payouts sont ensuite des claims legers. Marches: 1X2 (via dual-stat Subtract), over/under buts, corners, cartons, par periode.
- Pourquoi ca gagne: seul projet a utiliser validate_odds (les autres n'utiliseront que les scores); resout le cold-start de liquidite dont souffriront les 12 exchanges P2P concurrents; alignement direct avec la these business de TxODDS (leur feed de cotes devient une primitive de confiance); produit complet et demontrable sur les 16 matchs reels de la fenetre.
- Scope solo 18 j: programme Anchor (vault, ticket, verified_outcome, claim, audit_price), keeper TypeScript, front Next.js + Bun. Risque principal: gestion d'exposition de la maison; mitigation: plafond d'exposition par marche et par cote, marge fixe.

### Idee 2: HeartBreak Hedge, l'assurance parametrique du fan
- Concept: le fan couvre sa douleur. "La France sort en quarts? Rembourse." "Defaite aux tirs au but? Payout." "Carton rouge contre nous? Payout." Prime calculee depuis la probabilite implicite de la cote consensus au moment de l'achat, prouvable via validate_odds; payout automatique declenche par score proof via validate_stat. Des underwriters deposent en vault et encaissent les primes.
- Marches uniques permis par les stats par periode: passage en prolongation (stats ET1), decision aux tirs au but (PE), zero corner en 2e mi-temps. Tous les matchs restants sont a elimination directe: la prolongation et les tirs au but sont le sujet du moment.
- Pourquoi ca gagne: execute l'idee seed "Parametric Sports Insurance" des organisateurs mais avec le twist prime-prouvable que personne d'autre n'aura; mecanisme one-sided sans matching (le plus simple des trois a implementer correctement); la video demo la plus emotionnelle (storytelling fan, marche du coeur contre marche de la tete).
- Scope solo 18 j: le plus petit des trois. Risque: pricing actuariel simplifie (prime = probabilite implicite + marge), a assumer et documenter.

### Idee 3: 45' Markets, micro-marches parimutuel dynamiques par mi-temps
- Concept: chaque mi-temps de chaque match declenche une rafale de micro-marches (buts 2e MT over/under, corners 2e MT, difference de corners entre equipes). Pricing par parimutuel dynamique (DPM de Pennock): liquidite garantie sans market maker, zero risque protocole, prix continus qui integrent l'information en cours de match.
- Justification quant: le papier pm-AMM de Paradigm dit explicitement que le foot colle mal a son modele gaussien; le DPM n'a pas cette hypothese. Choix de mecanisme defendable devant des juges data.
- Settlement: le moteur publie une racine de resolution par marche apres une seule verification CPI, et les gagnants claiment avec un merkle proof de notre propre arbre. Le settlement lui-meme est merkle-ise, en symetrie avec le design TxLINE (claim_via_resolution).
- Pourquoi ca gagne: cadence de demo (des dizaines de marches se resolvent pendant la video), mecanisme quasi inedit en production sports, math en forme fermee implementable. Risques: DPM plus difficile a expliquer en 5 minutes; UX in-play a soigner avec le delai de 60 s du devnet.

### Tronc commun aux trois (a inclure quoi qu'on choisisse)
- UI "Verifiable Resolution": recu de preuve par pari (racine, chemin Merkle, lien vers la transaction de verification), demande presque explicitement par les juges
- Mode replay alimente par /api/scores/historical pour une demo autonome meme hors match live
- Integration du faucet USDT devnet pour que les juges testent en un clic
- Doc technique courte: endpoints TxLINE utilises + feedback API (exigence de soumission n° 5)

## 5. Verifications a faire au jour 1 du build (risques residuels)

1. Confirmer sur devnet qu'un match World Cup termine expose bien /api/scores/stat-validation avec des proofs soccer completes (le README public de tx-on-chain detaille surtout le college football/basketball US; la doc officielle montre pourtant un exemple soccer). Spike: recuperer une preuve pour un match termine et executer validateStat en .view()
2. Mesurer le compute reel d'un CPI validate_stat depuis notre programme (budget affiche: 1.4M CU, la limite d'une transaction); si trop juste, basculer sur la verification Merkle native dans notre programme en lisant le PDA de racine directement
3. Confirmer que le stream odds devnet couvre bien les marches vises (1X2, totals) pour les matchs restants

## 6. Sources principales

- Docs TxLINE: quickstart, worldcup, subscription-tiers, odds/overview, odds/odds-coverage, scores/overview, scores/soccer-feed, programs/addresses, programs/devnet, examples/fetching-snapshots, examples/streaming-data, examples/onchain-validation, docs.yaml (OpenAPI 95 Ko) sous https://txline.txodds.com/
- Repo: https://github.com/txodds/tx-on-chain
- Listing: https://superteam.fun/earn/listing/prediction-markets-and-settlement/
- Calendrier: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage , https://www.cbssports.com/soccer/news/world-cup-2026-schedule-times-dates/
- Patterns gagnants (non contre-verifies): blog.colosseum.com (perfecting-your-hackathon-submission, winners Radar/Breakout/Frontier), prnewswire.com (DisBet, Sandstorm)
- Mecanismes: https://www.paradigm.xyz/2024/11/pm-amm , Pennock DPM https://dl.acm.org/doi/10.1145/988772.988799
