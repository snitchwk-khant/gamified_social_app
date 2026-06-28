export function getFeed(req, res) {
  const feed = [
    { id: 1, title: "Product launch", message: "A new feature went live for enterprise users." },
    { id: 2, title: "Recognition", message: "Sophie earned the Collaboration badge." },
  ];

  return res.json({ feed });
}
