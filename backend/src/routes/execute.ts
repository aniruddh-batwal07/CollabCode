import { Router } from "express";
import { runPythonCode } from "../sandbox/pythonRunner";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { language, code } = req.body;

    if (language !== "python") {
      return res.status(400).json({
        error: "Unsupported language",
      });
    }

    const output =
      await runPythonCode(code);

    res.json({
      output,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Execution failed",
    });
  }
});

export default router;