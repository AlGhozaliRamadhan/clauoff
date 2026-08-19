async function testSearch(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CogitoSearch/1.0 (https://github.com/example/cogito)"
      }
    });
    const json = await response.json();
    console.log("Results found:", json.query?.search?.length);
    if (json.query?.search?.length > 0) {
        console.log("First result title:", json.query.search[0].title);
        console.log("Snippet:", json.query.search[0].snippet);
    }
  } catch (err) {
    console.error(err);
  }
}
testSearch('react js');
