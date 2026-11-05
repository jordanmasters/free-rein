#!/bin/bash
# A completion check: tests must pass.
npm test || exit 1
echo done >> events.jsonl
