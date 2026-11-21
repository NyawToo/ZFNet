import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import torch

from backend.app import main
from backend.app.core.deconvnet import DeconvExplainer
from backend.app.core import registry
from backend.app.core.zfnet import ZFNet


class TrainingContractTests(unittest.TestCase):
    def tearDown(self):
        main.TRAINING_JOBS.clear()

    def test_training_status_never_serializes_internal_process(self):
        main.TRAINING_JOBS["job-1"] = {
            "id": "job-1",
            "status": "running",
            "process": object(),
            "lines": ["started"],
            "returncode": None,
            "output": "checkpoint.pt",
            "log": "job.log",
        }

        payload = main.training_status("job-1")

        self.assertNotIn("process", payload)
        self.assertNotIn("output", payload)
        self.assertNotIn("log", payload)
        self.assertEqual(payload["status"], "running")
        self.assertIsNone(payload["checkpoint"])

    def test_dataset_class_count_prefers_manifest_labels(self):
        with tempfile.TemporaryDirectory() as directory:
            dataset = Path(directory)
            (dataset / "fruit" / "state-a").mkdir(parents=True)
            (dataset / "fruit" / "state-b").mkdir()
            (dataset / "dataset_manifest.json").write_text(
                json.dumps({"labels": ["state-a", "state-b"]}), encoding="utf-8"
            )

            self.assertEqual(main._dataset_class_count(dataset), 2)

    def test_manifest_labels_are_the_inference_order(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dataset = root / "dataset"
            dataset.mkdir()
            labels = ["banana_buena", "banana_dañada", "mango_buena", "mango_dañado"]
            (dataset / "dataset_manifest.json").write_text(
                json.dumps({"labels": labels}, ensure_ascii=False), encoding="utf-8"
            )

            with patch.object(registry, "ROOT", root):
                self.assertEqual(registry._labels_from_manifest("dataset"), labels)

    def test_checkpoint_with_wrong_class_count_is_rejected(self):
        state = {"fc8.weight": torch.empty(1000, 1024)}
        metadata = {"labels": ["banana_buena", "banana_dañada"]}

        with tempfile.TemporaryDirectory() as directory:
            checkpoint = Path(directory) / "wrong.pt"
            checkpoint.write_bytes(b"placeholder")
            with patch.object(registry, "_resolve_checkpoint", return_value=(checkpoint, True)), \
                    patch.object(registry.torch, "load", return_value={"state_dict": state, "meta": metadata}):
                registry.get_service.cache_clear()
                with self.assertRaisesRegex(RuntimeError, "tiene 1000 clases"):
                    registry.get_service()
                registry.get_service.cache_clear()

    def test_explainer_reuses_forward_cache(self):
        explainer = DeconvExplainer(ZFNet(num_classes=2))
        image = torch.randn(1, 3, 224, 224)

        with patch.object(explainer, "_forward", wraps=explainer._forward) as forward:
            activations, switches = explainer._forward(image)
            explainer.reconstruct(
                image,
                "conv1",
                int(activations["conv1"].shape[1] - 1),
                top_k=1,
                activations=activations,
                switches=switches,
            )
            explainer.activation_heatmap(image, "conv1", 0, activations=activations)

        self.assertEqual(forward.call_count, 1)


if __name__ == "__main__":
    unittest.main()
