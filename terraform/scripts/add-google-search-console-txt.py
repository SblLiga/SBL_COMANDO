"""Add Google Search Console domain verification TXT record to Route 53."""
import json
import subprocess
import sys
import tempfile

HOSTED_ZONE_ID = "Z01681933ALE73UA3CGTT"
TXT_VALUE = "google-site-verification=69QAKvhwLn4cvm29BQNXdmwmK2yOmZD34grJCLfL4no"


def main() -> int:
    batch = {
        "Changes": [
            {
                "Action": "UPSERT",
                "ResourceRecordSet": {
                    "Name": "sblliga.com",
                    "Type": "TXT",
                    "TTL": 300,
                    "ResourceRecords": [{"Value": f'"{TXT_VALUE}"'}],
                },
            }
        ]
    }
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as fh:
        json.dump(batch, fh)
        path = fh.name
    result = subprocess.run(
        [
            "aws",
            "route53",
            "change-resource-record-sets",
            "--hosted-zone-id",
            HOSTED_ZONE_ID,
            "--change-batch",
            f"file://{path}",
            "--output",
            "json",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    print(result.stdout or result.stderr)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
