<script lang="ts">
  type Section = { title: string; content: string };
  type Worked = { id: string; problem: string; solution: string };
  type Pitfall = { id: string; description: string; correction: string };
  type Source = { author: string; year: string; title: string; url?: string };

  type Labels = {
    title: string;
    sections: string;
    worked: string;
    pitfalls: string;
    sources: string;
    sourceAuthor: string;
    sourceYear: string;
    sourceTitle: string;
    sourceUrl: string;
  };

  let {
    sections = [],
    worked = [],
    pitfalls = [],
    sources = [],
    labels = {
      title: "Render de estudio",
      sections: "Sections",
      worked: "Worked Examples",
      pitfalls: "Common Pitfalls",
      sources: "Sources",
      sourceAuthor: "Author",
      sourceYear: "Year",
      sourceTitle: "Title",
      sourceUrl: "URL"
    }
  }: {
    sections?: Section[];
    worked?: Worked[];
    pitfalls?: Pitfall[];
    sources?: Source[];
    labels?: Labels;
  } = $props();
</script>

<div class="study-renderer">
  <h1>{labels.title}</h1>

  {#if sections.length > 0}
    <section aria-labelledby="sections-heading">
      <h2 id="sections-heading">{labels.sections}</h2>
      {#each sections as section (section.title)}
        <article>
          <h3>{section.title}</h3>
          <p>{section.content}</p>
        </article>
      {/each}
    </section>
  {/if}

  {#if worked.length > 0}
    <section aria-labelledby="worked-heading">
      <h2 id="worked-heading">{labels.worked}</h2>
      {#each worked as item (item.id)}
        <div class="worked-example">
          <strong>{item.problem}</strong>
          <p>{item.solution}</p>
        </div>
      {/each}
    </section>
  {/if}

  {#if pitfalls.length > 0}
    <section aria-labelledby="pitfalls-heading">
      <h2 id="pitfalls-heading">{labels.pitfalls}</h2>
      {#each pitfalls as pitfall (pitfall.id)}
        <div class="pitfall">
          <strong>{pitfall.description}</strong>
          <p>{pitfall.correction}</p>
        </div>
      {/each}
    </section>
  {/if}

  {#if sources.length > 0}
    <section aria-labelledby="sources-heading">
      <h2 id="sources-heading">{labels.sources}</h2>
      <table aria-labelledby="sources-heading" class="sources-table">
        <thead>
          <tr>
            <th scope="col">{labels.sourceAuthor}</th>
            <th scope="col">{labels.sourceYear}</th>
            <th scope="col">{labels.sourceTitle}</th>
            <th scope="col">{labels.sourceUrl}</th>
          </tr>
        </thead>
        <tbody>
          {#each sources as source}
            <tr>
              <td>{source.author}</td>
              <td>{source.year}</td>
              <td>{source.title}</td>
              <td>
                {#if source.url}
                  <a href={source.url} target="_blank" rel="noopener noreferrer">{source.url}</a>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/if}
</div>

<style>
  .study-renderer {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  .sources-table {
    width: 100%;
    border-collapse: collapse;
  }
  .sources-table th, .sources-table td {
    border: 1px solid #ccc;
    padding: 0.5rem;
    text-align: left;
  }
  .sources-table th {
    background: #f5f5f5;
  }
</style>
