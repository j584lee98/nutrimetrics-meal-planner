"use client";

import { useState, type FormEvent } from "react";
import type { FoodSearchResults } from "@/lib/food-search";

export function FoodSearch() {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResults | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search(term: string, page: number) {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: term, page: String(page) });
      const response = await fetch(`/api/foods/search?${params}`, { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json();
        setError(typeof body.error === "string" ? body.error : "Food search failed. Please try again.");
        return;
      }
      const data: FoodSearchResults = await response.json();
      setResults(data);
      setSearchedQuery(term);
    } catch (cause) {
      console.error("Food search request failed", cause);
      setError("Could not complete the search. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term) {
      setError("Enter a food to search for.");
      return;
    }
    setResults(null);
    void search(term, 1);
  }

  return (
    <section className="search-panel" aria-labelledby="food-search-heading">
      <p className="eyebrow">FOOD LIBRARY</p>
      <h2 id="food-search-heading">Find a food.</h2>
      <p className="search-intro">Explore foods and their reported nutrients from USDA FoodData Central.</p>
      <form className="search-form" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="food-query">Search foods</label>
        <input id="food-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try apple, eggs, or oatmeal" maxLength={100} required />
        <button className="button" disabled={loading} type="submit">{loading ? "Searching..." : "Search foods"}</button>
      </form>
      {error && <p className="form-error search-message" role="alert">{error}</p>}
      <div aria-live="polite">
        {loading && <p className="search-message">Searching USDA foods...</p>}
        {!loading && results && (
          <>
            <p className="search-summary">
              {results.totalHits === 0
                ? `No foods found for “${searchedQuery}”.`
                : `${results.totalHits.toLocaleString()} results for “${searchedQuery}”`}
            </p>
            <div className="food-list">
              {results.foods.map((food) => (
                <article className="food-result" key={food.fdcId}>
                  <div className="food-result-heading">
                    <div>
                      <h3>{food.description}</h3>
                      <p>{[food.dataType, food.brand, `FDC ID: ${food.fdcId}`].filter(Boolean).join(" · ")}</p>
                    </div>
                    <a href={`https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`} target="_blank" rel="noopener noreferrer">USDA details <span className="visually-hidden">(opens in a new tab)</span>↗</a>
                  </div>
                  <details>
                    <summary>View reported nutrients</summary>
                    <p className="nutrient-note">Values are reported per 100 g or 100 mL, depending on the food. Check the USDA details for the applicable basis. Some amounts are calculated from label values or less-than values. Missing nutrients are not necessarily zero.</p>
                    {food.nutrients.length === 0 ? (
                      <p className="nutrient-note">No nutrient values were returned for this food.</p>
                    ) : (
                      <div className="table-scroll">
                        <table>
                          <thead><tr><th scope="col">Nutrient</th><th scope="col">Amount</th><th scope="col">USDA derivation</th></tr></thead>
                          <tbody>
                            {food.nutrients.map((nutrient, index) => (
                              <tr key={`${nutrient.id}-${index}`}><th scope="row">{nutrient.name}</th><td>{nutrient.value.toLocaleString(undefined, { maximumSignificantDigits: 8 })} {nutrient.unit}</td><td>{nutrient.derivation ?? "Not provided"}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </details>
                </article>
              ))}
            </div>
            {results.totalPages > 1 && (
              <nav className="pagination" aria-label="Food search pages">
                <button className="button button-secondary button-small" disabled={loading || results.currentPage <= 1} onClick={() => void search(searchedQuery, results.currentPage - 1)}>Previous</button>
                <span>Page {results.currentPage.toLocaleString()} of {results.totalPages.toLocaleString()}</span>
                <button className="button button-secondary button-small" disabled={loading || results.currentPage >= results.totalPages || results.currentPage >= 9999} onClick={() => void search(searchedQuery, results.currentPage + 1)}>Next</button>
              </nav>
            )}
          </>
        )}
      </div>
      <p className="source-note">Source: U.S. Department of Agriculture, Agricultural Research Service, <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener noreferrer">FoodData Central</a>. Search results are not saved to your account.</p>
    </section>
  );
}
