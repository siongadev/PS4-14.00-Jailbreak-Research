# Captures

The collector writes one JSON record per saved run here. Raw captures are ignored by Git because they can contain session and local-network details. Keep capture IDs and SHA-256 values with the corresponding research note, and preserve the files in a verified local archive when needed.

Verify a copied capture with `python -m fw14lab.verify captures/CAPTURE_ID.json`. See [evidence rules](../docs/EVIDENCE_RULES.md).
