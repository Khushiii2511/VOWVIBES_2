/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
    const chapterId = params.id;

    const API_URL = `https://sanskrit.ie/api/geeta.php?q=${chapterId}`;

    console.log("Fetching:", API_URL);

    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`API fetch failed with status: ${response.status}`);
        }

        // API RETURNS JSON — NOT HTML
        const apiData = await response.json();

        if (!apiData.data || apiData.data.length === 0) {
            throw new Error("API returned no data");
        }

        // Extract the big HTML content inside "lyrics"
        const html = apiData.data[0].lyrics;

        if (!html) {
            throw new Error("Lyrics not found in API");
        }

        // Extract verses inside <p>…</p>
        const verses = [
            ...html.matchAll(/<p[^>]*>(.*?)<\/p>/g)
        ].map(m => m[1].trim());

        if (verses.length === 0) {
            throw new Error("No <p> verses found inside lyrics HTML");
        }

        // Convert each <p> to JSON shlok objects
        const chapterData = verses.map((text, index) => ({
            shlok_no: index + 1,
            shlok: text
        }));

        // ADDED → send full text for text-to-speech
        const fullText = verses.join(". ");

        console.log("Extracted verses:", chapterData.length);

        return {
            chapterData,
            fullText   // <- Added for TTS use in +page.svelte
        };

    } catch (error) {
        console.error("SERVER FETCH ERROR:", error);
        return {
            error: true,
            message: error.message,
            chapterData: [],
            fullText: ""
        };
    }
}
