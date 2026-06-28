import express from "express";

const router = express.Router();

router.get("/activities", async (req, res) => {
  const feed = [
    { id: 1, title: "Product launch", message: "A new feature went live for enterprise users." },
    { id: 2, title: "Recognition", message: "Sophie earned the Collaboration badge." },
  ];

  res.json({ feed });
});

export default router;
