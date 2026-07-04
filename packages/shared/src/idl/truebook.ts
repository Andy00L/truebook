/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/truebook.json`.
 */
export type Truebook = {
  "address": "59txn6d3rHFtvhocB5ZvhhJsTurGNq1d1gcbDy7o43fh",
  "metadata": {
    "name": "truebook",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "auditTicket",
      "discriminator": [
        28,
        152,
        109,
        76,
        109,
        236,
        247,
        246
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          },
          "relations": [
            "market"
          ]
        },
        {
          "name": "market"
        },
        {
          "name": "ticket",
          "writable": true
        },
        {
          "name": "dailyOddsMerkleRoots",
          "docs": [
            "PDA derived from the proof timestamp, and the CPI validates its data."
          ]
        },
        {
          "name": "txoracleProgram",
          "address": "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "validateOddsArgs"
            }
          }
        }
      ]
    },
    {
      "name": "createMarket",
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "house"
              },
              {
                "kind": "account",
                "path": "house.market_count",
                "account": "house"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "fixtureId",
          "type": "i64"
        },
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "marketParams"
            }
          }
        },
        {
          "name": "outcomePriceIndex",
          "type": "u8"
        },
        {
          "name": "kickoffTs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "depositLiquidity",
      "discriminator": [
        245,
        99,
        59,
        25,
        151,
        71,
        233,
        249
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "authorityTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeHouse",
      "discriminator": [
        180,
        46,
        86,
        125,
        135,
        107,
        214,
        28
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "usdtMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "house"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marginBps",
          "type": "u16"
        },
        {
          "name": "maxExposurePerMarket",
          "type": "u64"
        },
        {
          "name": "maxPayoutPerTicket",
          "type": "u64"
        }
      ]
    },
    {
      "name": "lockMarket",
      "discriminator": [
        107,
        8,
        184,
        91,
        223,
        13,
        180,
        38
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "placeBet",
      "discriminator": [
        222,
        62,
        67,
        220,
        63,
        166,
        126,
        33
      ],
      "accounts": [
        {
          "name": "bettor",
          "writable": true,
          "signer": true
        },
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          },
          "relations": [
            "market"
          ]
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "ticket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  99,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "bettor"
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "bettorTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u64"
        },
        {
          "name": "side",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        },
        {
          "name": "stake",
          "type": "u64"
        }
      ]
    },
    {
      "name": "postQuote",
      "discriminator": [
        68,
        231,
        88,
        224,
        13,
        116,
        27,
        84
      ],
      "accounts": [
        {
          "name": "keeper",
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          },
          "relations": [
            "market"
          ]
        },
        {
          "name": "market",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "yesOddsBps",
          "type": "u32"
        },
        {
          "name": "noOddsBps",
          "type": "u32"
        },
        {
          "name": "oddsMessageId",
          "type": "string"
        },
        {
          "name": "oddsTs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "refundTicket",
      "discriminator": [
        178,
        97,
        75,
        218,
        227,
        28,
        21,
        73
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          },
          "relations": [
            "market"
          ]
        },
        {
          "name": "market"
        },
        {
          "name": "ticket",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "bettorTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "settleTicket",
      "discriminator": [
        201,
        80,
        119,
        145,
        208,
        184,
        168,
        70
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          },
          "relations": [
            "market"
          ]
        },
        {
          "name": "market"
        },
        {
          "name": "verifiedOutcome",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  117,
                  116,
                  99,
                  111,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "ticket",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "bettorTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "verifyMarket",
      "discriminator": [
        117,
        131,
        234,
        199,
        26,
        123,
        63,
        62
      ],
      "accounts": [
        {
          "name": "cranker",
          "writable": true,
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          },
          "relations": [
            "market"
          ]
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "verifiedOutcome",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  117,
                  116,
                  99,
                  111,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "dailyScoresMerkleRoots",
          "docs": [
            "PDA derived from the proof timestamp, and the CPI itself validates its data."
          ]
        },
        {
          "name": "txoracleProgram",
          "address": "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "validateStatArgs"
            }
          }
        },
        {
          "name": "seq",
          "type": "u32"
        }
      ]
    },
    {
      "name": "voidMarket",
      "discriminator": [
        243,
        175,
        46,
        124,
        95,
        101,
        39,
        69
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          },
          "relations": [
            "market"
          ]
        },
        {
          "name": "market",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "withdrawLiquidity",
      "discriminator": [
        149,
        158,
        33,
        185,
        47,
        243,
        253,
        31
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "authorityTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "house",
      "discriminator": [
        21,
        145,
        94,
        109,
        254,
        199,
        210,
        151
      ]
    },
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "ticket",
      "discriminator": [
        41,
        228,
        24,
        165,
        78,
        90,
        235,
        200
      ]
    },
    {
      "name": "verifiedOutcome",
      "discriminator": [
        60,
        246,
        53,
        115,
        50,
        54,
        80,
        24
      ]
    }
  ],
  "events": [
    {
      "name": "betPlaced",
      "discriminator": [
        88,
        88,
        145,
        226,
        126,
        206,
        32,
        0
      ]
    },
    {
      "name": "houseInitialized",
      "discriminator": [
        208,
        164,
        111,
        41,
        25,
        245,
        243,
        41
      ]
    },
    {
      "name": "liquidityChanged",
      "discriminator": [
        132,
        132,
        193,
        214,
        12,
        99,
        40,
        28
      ]
    },
    {
      "name": "marketCreated",
      "discriminator": [
        88,
        184,
        130,
        231,
        226,
        84,
        6,
        58
      ]
    },
    {
      "name": "marketLocked",
      "discriminator": [
        57,
        30,
        242,
        116,
        238,
        156,
        185,
        189
      ]
    },
    {
      "name": "marketVerified",
      "discriminator": [
        253,
        194,
        174,
        5,
        12,
        50,
        68,
        124
      ]
    },
    {
      "name": "marketVoided",
      "discriminator": [
        217,
        12,
        138,
        39,
        108,
        75,
        89,
        26
      ]
    },
    {
      "name": "quotePosted",
      "discriminator": [
        130,
        69,
        35,
        209,
        183,
        130,
        239,
        156
      ]
    },
    {
      "name": "ticketAudited",
      "discriminator": [
        142,
        155,
        242,
        144,
        246,
        166,
        170,
        172
      ]
    },
    {
      "name": "ticketSettled",
      "discriminator": [
        72,
        40,
        13,
        3,
        184,
        159,
        190,
        211
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "housePaused",
      "msg": "House is paused; no new bets accepted."
    },
    {
      "code": 6001,
      "name": "invalidMargin",
      "msg": "Margin basis points must be greater than zero and below 100 percent."
    },
    {
      "code": 6002,
      "name": "invalidOdds",
      "msg": "Odds must be strictly greater than 1.0 (10000 bps)."
    },
    {
      "code": 6003,
      "name": "zeroStake",
      "msg": "Stake must be greater than zero."
    },
    {
      "code": 6004,
      "name": "quoteExpired",
      "msg": "The served quote has expired; refresh it before betting."
    },
    {
      "code": 6005,
      "name": "marketNotOpen",
      "msg": "The market is not open for betting."
    },
    {
      "code": 6006,
      "name": "kickoffPassed",
      "msg": "Kickoff has already passed for this market."
    },
    {
      "code": 6007,
      "name": "kickoffNotReached",
      "msg": "Kickoff has not been reached yet; the market cannot be locked."
    },
    {
      "code": 6008,
      "name": "marketNotLocked",
      "msg": "The market is not locked."
    },
    {
      "code": 6009,
      "name": "outcomeNotVerified",
      "msg": "The market outcome has not been verified yet."
    },
    {
      "code": 6010,
      "name": "outcomeAlreadyVerified",
      "msg": "The market outcome has already been verified."
    },
    {
      "code": 6011,
      "name": "exposureCapExceeded",
      "msg": "Potential payout would exceed the house exposure cap for this market."
    },
    {
      "code": 6012,
      "name": "payoutCapExceeded",
      "msg": "Potential payout exceeds the per-ticket cap."
    },
    {
      "code": 6013,
      "name": "insufficientLiquidity",
      "msg": "The house vault has insufficient free liquidity to cover this payout."
    },
    {
      "code": 6014,
      "name": "withdrawalBelowExposure",
      "msg": "Withdrawal would drop the vault below its open exposure."
    },
    {
      "code": 6015,
      "name": "ticketAlreadySettled",
      "msg": "The ticket has already been settled."
    },
    {
      "code": 6016,
      "name": "ticketMarketMismatch",
      "msg": "The ticket does not belong to this market."
    },
    {
      "code": 6017,
      "name": "fixtureMismatch",
      "msg": "The proof timestamp does not match the market fixture."
    },
    {
      "code": 6018,
      "name": "validationNoResult",
      "msg": "The oracle validation returned no result."
    },
    {
      "code": 6019,
      "name": "oddsNotAuthentic",
      "msg": "The referenced odds record could not be authenticated against consensus."
    },
    {
      "code": 6020,
      "name": "noPriceViolation",
      "msg": "The ticket price is within the stated margin; no violation to refund."
    },
    {
      "code": 6021,
      "name": "voidGraceNotElapsed",
      "msg": "The market grace period for voiding has not elapsed."
    },
    {
      "code": 6022,
      "name": "ticketNotRefundable",
      "msg": "The ticket is not in a refundable state."
    },
    {
      "code": 6023,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow."
    },
    {
      "code": 6024,
      "name": "messageIdTooLong",
      "msg": "The provided odds MessageId exceeds the maximum stored length."
    },
    {
      "code": 6025,
      "name": "unauthorized",
      "msg": "Unauthorized: signer is not the house authority."
    },
    {
      "code": 6026,
      "name": "predicateMismatch",
      "msg": "The proof predicate does not match the market's committed predicate."
    },
    {
      "code": 6027,
      "name": "invalidRootAccount",
      "msg": "The provided daily-root account does not match the timestamp's expected PDA."
    },
    {
      "code": 6028,
      "name": "oddsRecordMismatch",
      "msg": "The audited odds record does not match the ticket's referenced quote."
    }
  ],
  "types": [
    {
      "name": "auditStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "unaudited"
          },
          {
            "name": "honest"
          },
          {
            "name": "violation"
          }
        ]
      }
    },
    {
      "name": "betPlaced",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "ticket",
            "type": "pubkey"
          },
          {
            "name": "bettor",
            "type": "pubkey"
          },
          {
            "name": "sideIsYes",
            "type": "bool"
          },
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "quotedOddsBps",
            "type": "u32"
          },
          {
            "name": "potentialPayout",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "binaryOp",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "none"
          },
          {
            "name": "add"
          },
          {
            "name": "subtract"
          }
        ]
      }
    },
    {
      "name": "comparison",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "greaterThan"
          },
          {
            "name": "lessThan"
          },
          {
            "name": "equalTo"
          }
        ]
      }
    },
    {
      "name": "house",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "usdtMint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "marginBps",
            "type": "u16"
          },
          {
            "name": "maxExposurePerMarket",
            "type": "u64"
          },
          {
            "name": "maxPayoutPerTicket",
            "type": "u64"
          },
          {
            "name": "openExposure",
            "type": "u64"
          },
          {
            "name": "totalVolume",
            "type": "u64"
          },
          {
            "name": "marketCount",
            "type": "u64"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "houseInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "usdtMint",
            "type": "pubkey"
          },
          {
            "name": "marginBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "liquidityChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "house",
            "type": "pubkey"
          },
          {
            "name": "deposit",
            "type": "bool"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "newVaultBalance",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "house",
            "type": "pubkey"
          },
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "params",
            "type": {
              "defined": {
                "name": "marketParams"
              }
            }
          },
          {
            "name": "outcomePriceIndex",
            "type": "u8"
          },
          {
            "name": "kickoffTs",
            "type": "i64"
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "marketState"
              }
            }
          },
          {
            "name": "yesOddsBps",
            "type": "u32"
          },
          {
            "name": "noOddsBps",
            "type": "u32"
          },
          {
            "name": "oddsMessageId",
            "type": "string"
          },
          {
            "name": "oddsTs",
            "type": "i64"
          },
          {
            "name": "quotePostedTs",
            "type": "i64"
          },
          {
            "name": "yesStake",
            "type": "u64"
          },
          {
            "name": "noStake",
            "type": "u64"
          },
          {
            "name": "yesPayout",
            "type": "u64"
          },
          {
            "name": "noPayout",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "marketCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "kickoffTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketLocked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "lockedTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "statAKey",
            "type": "u32"
          },
          {
            "name": "statAPeriod",
            "type": "i32"
          },
          {
            "name": "statBKey",
            "type": "u32"
          },
          {
            "name": "statBPeriod",
            "type": "i32"
          },
          {
            "name": "hasStatB",
            "type": "bool"
          },
          {
            "name": "op",
            "type": {
              "defined": {
                "name": "binaryOp"
              }
            }
          },
          {
            "name": "comparison",
            "type": {
              "defined": {
                "name": "comparison"
              }
            }
          },
          {
            "name": "threshold",
            "type": "i32"
          }
        ]
      }
    },
    {
      "name": "marketState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "locked"
          },
          {
            "name": "verified"
          },
          {
            "name": "settled"
          },
          {
            "name": "voided"
          }
        ]
      }
    },
    {
      "name": "marketVerified",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "bool"
          },
          {
            "name": "seq",
            "type": "u32"
          },
          {
            "name": "verifiedTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketVoided",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "voidedTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "quotePosted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "yesOddsBps",
            "type": "u32"
          },
          {
            "name": "noOddsBps",
            "type": "u32"
          },
          {
            "name": "oddsMessageId",
            "type": "string"
          },
          {
            "name": "oddsTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "side",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "yes"
          },
          {
            "name": "no"
          }
        ]
      }
    },
    {
      "name": "ticket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "bettor",
            "type": "pubkey"
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "quotedOddsBps",
            "type": "u32"
          },
          {
            "name": "oddsMessageId",
            "type": "string"
          },
          {
            "name": "oddsTs",
            "type": "i64"
          },
          {
            "name": "potentialPayout",
            "type": "u64"
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "ticketState"
              }
            }
          },
          {
            "name": "auditStatus",
            "type": {
              "defined": {
                "name": "auditStatus"
              }
            }
          },
          {
            "name": "createdTs",
            "type": "i64"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ticketAudited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "ticket",
            "type": "pubkey"
          },
          {
            "name": "authentic",
            "type": "bool"
          },
          {
            "name": "violation",
            "type": "bool"
          },
          {
            "name": "servedImpliedBps",
            "type": "u32"
          },
          {
            "name": "consensusImpliedBps",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "ticketSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "ticket",
            "type": "pubkey"
          },
          {
            "name": "bettor",
            "type": "pubkey"
          },
          {
            "name": "won",
            "type": "bool"
          },
          {
            "name": "payout",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ticketState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "live"
          },
          {
            "name": "won"
          },
          {
            "name": "lost"
          },
          {
            "name": "claimed"
          },
          {
            "name": "refundable"
          },
          {
            "name": "refunded"
          }
        ]
      }
    },
    {
      "name": "txBinaryExpression",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "add"
          },
          {
            "name": "subtract"
          }
        ]
      }
    },
    {
      "name": "txComparison",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "greaterThan"
          },
          {
            "name": "lessThan"
          },
          {
            "name": "equalTo"
          }
        ]
      }
    },
    {
      "name": "txOdds",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "messageId",
            "type": "string"
          },
          {
            "name": "ts",
            "type": "i64"
          },
          {
            "name": "bookmaker",
            "type": "string"
          },
          {
            "name": "bookmakerId",
            "type": "i32"
          },
          {
            "name": "superOddsType",
            "type": "string"
          },
          {
            "name": "gameState",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "inRunning",
            "type": "bool"
          },
          {
            "name": "marketParameters",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "marketPeriod",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "priceNames",
            "type": {
              "vec": "string"
            }
          },
          {
            "name": "prices",
            "type": {
              "vec": "i32"
            }
          }
        ]
      }
    },
    {
      "name": "txOddsBatchSummary",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "updateStats",
            "type": {
              "defined": {
                "name": "txOddsUpdateStats"
              }
            }
          },
          {
            "name": "oddsSubTreeRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "txOddsUpdateStats",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "updateCount",
            "type": "u32"
          },
          {
            "name": "minTimestamp",
            "type": "i64"
          },
          {
            "name": "maxTimestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "txProofNode",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "isRightSibling",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "txScoreStat",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "key",
            "type": "u32"
          },
          {
            "name": "value",
            "type": "i32"
          },
          {
            "name": "period",
            "type": "i32"
          }
        ]
      }
    },
    {
      "name": "txScoresBatchSummary",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "updateStats",
            "type": {
              "defined": {
                "name": "txScoresUpdateStats"
              }
            }
          },
          {
            "name": "eventsSubTreeRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "txScoresUpdateStats",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "updateCount",
            "type": "i32"
          },
          {
            "name": "minTimestamp",
            "type": "i64"
          },
          {
            "name": "maxTimestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "txStatTerm",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "statToProve",
            "type": {
              "defined": {
                "name": "txScoreStat"
              }
            }
          },
          {
            "name": "eventStatRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "statProof",
            "type": {
              "vec": {
                "defined": {
                  "name": "txProofNode"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "txTraderPredicate",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "threshold",
            "type": "i32"
          },
          {
            "name": "comparison",
            "type": {
              "defined": {
                "name": "txComparison"
              }
            }
          }
        ]
      }
    },
    {
      "name": "validateOddsArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ts",
            "type": "i64"
          },
          {
            "name": "oddsSnapshot",
            "type": {
              "defined": {
                "name": "txOdds"
              }
            }
          },
          {
            "name": "summary",
            "type": {
              "defined": {
                "name": "txOddsBatchSummary"
              }
            }
          },
          {
            "name": "subTreeProof",
            "type": {
              "vec": {
                "defined": {
                  "name": "txProofNode"
                }
              }
            }
          },
          {
            "name": "mainTreeProof",
            "type": {
              "vec": {
                "defined": {
                  "name": "txProofNode"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "validateStatArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ts",
            "type": "i64"
          },
          {
            "name": "fixtureSummary",
            "type": {
              "defined": {
                "name": "txScoresBatchSummary"
              }
            }
          },
          {
            "name": "fixtureProof",
            "type": {
              "vec": {
                "defined": {
                  "name": "txProofNode"
                }
              }
            }
          },
          {
            "name": "mainTreeProof",
            "type": {
              "vec": {
                "defined": {
                  "name": "txProofNode"
                }
              }
            }
          },
          {
            "name": "predicate",
            "type": {
              "defined": {
                "name": "txTraderPredicate"
              }
            }
          },
          {
            "name": "statA",
            "type": {
              "defined": {
                "name": "txStatTerm"
              }
            }
          },
          {
            "name": "statB",
            "type": {
              "option": {
                "defined": {
                  "name": "txStatTerm"
                }
              }
            }
          },
          {
            "name": "op",
            "type": {
              "option": {
                "defined": {
                  "name": "txBinaryExpression"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "verifiedOutcome",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "bool"
          },
          {
            "name": "seq",
            "type": "u32"
          },
          {
            "name": "verifiedTs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "houseSeed",
      "type": "bytes",
      "value": "[104, 111, 117, 115, 101]"
    },
    {
      "name": "marketSeed",
      "type": "bytes",
      "value": "[109, 97, 114, 107, 101, 116]"
    },
    {
      "name": "outcomeSeed",
      "type": "bytes",
      "value": "[111, 117, 116, 99, 111, 109, 101]"
    },
    {
      "name": "ticketSeed",
      "type": "bytes",
      "value": "[116, 105, 99, 107, 101, 116]"
    },
    {
      "name": "txlineDailyBatchSeed",
      "type": "bytes",
      "value": "[100, 97, 105, 108, 121, 95, 98, 97, 116, 99, 104, 95, 114, 111, 111, 116, 115]"
    },
    {
      "name": "txlineDailyScoresSeed",
      "type": "bytes",
      "value": "[100, 97, 105, 108, 121, 95, 115, 99, 111, 114, 101, 115, 95, 114, 111, 111, 116, 115]"
    },
    {
      "name": "txlineProgramId",
      "type": "pubkey",
      "value": "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"
    },
    {
      "name": "vaultSeed",
      "type": "bytes",
      "value": "[118, 97, 117, 108, 116]"
    }
  ]
};
