const table = document.getElementById("reference-table");
const thead = table.querySelector("thead");
const tbody = table.querySelector("tbody");
const pdfButton = document.getElementById("download-pdf");

const renderTable = (columns, records) => {
  const headRow = document.createElement("tr");
  columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  records.forEach((record, rowIndex) => {
    const tr = document.createElement("tr");
    columns.forEach((col) => {
      const td = document.createElement("td");
      const raw = record[col] ?? "";
      td.textContent = col === "№" && !String(raw).trim() ? String(rowIndex + 1) : raw;
      if (col !== "№") {
        td.setAttribute("contenteditable", "plaintext-only");
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
};

const init = async () => {
  const response = await fetch("./data/reference-data.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Не удалось загрузить данные таблицы");
  }

  const payload = await response.json();
  renderTable(payload.meta.columns, payload.records);

  pdfButton.addEventListener("click", async () => {
    pdfButton.disabled = true;
    const original = pdfButton.textContent;
    pdfButton.textContent = "Подготовка PDF...";
    let mount = null;

    try {
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }

      const source = document.getElementById("pdf-root");
      const target = source.cloneNode(true);
      target.id = "pdf-export-root";
      target.classList.add("pdf-export-mode");

      target.querySelectorAll("[contenteditable]").forEach((cell) => {
        cell.removeAttribute("contenteditable");
      });

      mount = document.createElement("div");
      mount.style.position = "fixed";
      mount.style.left = "-99999px";
      mount.style.top = "0";
      mount.style.width = "277mm";
      mount.style.background = "#ffffff";
      mount.appendChild(target);
      document.body.appendChild(mount);

      const options = {
        margin: [8, 8, 8, 8],
        filename: "reference-list.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] }
      };

      await html2pdf().from(target).set(options).save();
    } finally {
      if (mount) {
        mount.remove();
      }
      pdfButton.disabled = false;
      pdfButton.textContent = original;
    }
  });
};

init().catch((error) => {
  console.error(error);
  tbody.innerHTML = "<tr><td colspan='8'>Ошибка загрузки данных. Проверьте файл JSON.</td></tr>";
});
