import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import './App.css';

function App() {
  const [langData, setLangData] = useState({});
  const [mapping, setMapping] = useState({});
  const [gameName, setGameName] = useState('');
  const [dropdownOptions, setDropdownOptions] = useState([
    'game', 'rtp', 'description', 'wins', 'wild', 'scatter', 'features'
  ]);
  const [newOption, setNewOption] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [customHeaders, setCustomHeaders] = useState({});

  const handleFolderUpload = async (e) => {
    const fileList = Array.from(e.target.files);
    const excelFiles = fileList.filter(f => f.name.endsWith('.xlsx') && !f.name.startsWith('~$'));

    const langParsed = {};

    for (const file of excelFiles) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.worksheets[0];

      const lang = file.name.split('.')[0];
      let hasBold = false;

      worksheet.eachRow((row) => {
        const cell = row.getCell(1);
        const isBold = cell.font?.bold === true;
        if (isBold) hasBold = true;
      });

      if (!hasBold) {
        const flatLines = [];
        worksheet.eachRow((row) => {
          const cell = row.getCell(1);
          const text = (cell.value || '').toString().trim();
          if (text) flatLines.push(text);
        });

        langParsed[lang] = [{ header: gameName || '', content: '' }, ...flatLines];

      } else {
        const pairs = [];
        let current = null;

        worksheet.eachRow((row) => {
          const cell = row.getCell(1);
          const cellValue = (cell.value || '').toString().trim();
          if (!cellValue) return;

          const isBold = cell.font?.bold === true;

          if (isBold) {
            if (current) pairs.push(current);
            current = { header: cellValue, content: '' };
          } else if (current) {
            current.content += (current.content ? '\n' : '') + cellValue;
          }
        });

        if (current) pairs.push(current);
        langParsed[lang] = pairs;
      }
    }

    setLangData(langParsed);
    const firstLangKey = Object.keys(langParsed)[0];
    setGameName(prev => prev || langParsed[firstLangKey]?.[0]?.header || '');

    setCustomHeaders({});
  };

  const handleMappingChange = (header, key) => {
    setMapping(prev => ({ ...prev, [header]: key }));
  };

  const handleDeleteMappingLine = (header) => {
    setMapping(prev => {
      const updated = { ...prev };
      delete updated[header];
      return updated;
    });
  };

  const handleAddOption = () => {
    const trimmed = newOption.trim();
    if (trimmed && !dropdownOptions.includes(trimmed)) {
      setDropdownOptions(prev => [...prev, trimmed]);
      setNewOption('');
    }
  };

  const handleRemoveOption = (opt) => {
    if (!window.confirm(`Remove key "${opt}" from all dropdowns?`)) return;

    setDropdownOptions(prev => prev.filter(o => o !== opt));
    const updatedMapping = { ...mapping };
    Object.keys(updatedMapping).forEach(header => {
      if (updatedMapping[header] === opt) {
        delete updatedMapping[header];
      }
    });
    setMapping(updatedMapping);
  };

  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDragOver = (index) => {
    if (dragIndex === null || dragIndex === index) return;
    const newOrder = [...dropdownOptions];
    const dragged = newOrder.splice(dragIndex, 1)[0];
    newOrder.splice(index, 0, dragged);
    setDropdownOptions(newOrder);
    setDragIndex(index);
  };

  const handleDeleteLine = (lineIdx) => {
    setLangData(prevData => {
      const updated = { ...prevData };
      Object.keys(updated).forEach(lang => {
        const lines = updated[lang].slice();
        lines.splice(lineIdx + 1, 1);
        updated[lang] = lines;
      });
      return updated;
    });

    setCustomHeaders(prev => {
      const newHeaders = {};
      Object.keys(prev).forEach(k => {
        const i = parseInt(k);
        if (i < lineIdx) newHeaders[i] = true;
        else if (i > lineIdx) newHeaders[i - 1] = true;
      });
      return newHeaders;
    });
  };

  const buildJson = (lang) => {
    const lines = langData[lang] || [];
    const textLines = lines.slice(1);

    const output = { header: gameName };

    dropdownOptions.forEach(key => {
      output[key] = key === 'features' ? [] : { header: '', content: '' };
    });

    let currentHeader = '';
    let contentLines = [];

    textLines.forEach((line, idx) => {
      if (customHeaders[idx]) {
        if (currentHeader) {
          const mappedKey = mapping[currentHeader];
          if (mappedKey && dropdownOptions.includes(mappedKey)) {
            if (mappedKey === 'features') {
              output.features.push({ header: currentHeader, content: contentLines.join('\n') });
            } else {
              output[mappedKey] = { header: currentHeader, content: contentLines.join('\n') };
            }
          }
        }
        currentHeader = line;
        contentLines = [];
      } else {
        contentLines.push(line);
      }
    });

    if (currentHeader) {
      const mappedKey = mapping[currentHeader];
      if (mappedKey && dropdownOptions.includes(mappedKey)) {
        if (mappedKey === 'features') {
          output.features.push({ header: currentHeader, content: contentLines.join('\n') });
        } else {
          output[mappedKey] = { header: currentHeader, content: contentLines.join('\n') };
        }
      }
    }

    Object.keys(output).forEach(key => {
      if (key !== 'header' && !dropdownOptions.includes(key)) {
        delete output[key];
      }
    });

    return output;
  };

  const handleExport = async () => {
    const zip = new JSZip();
    Object.keys(langData).forEach(lang => {
      const json = buildJson(lang);
      zip.file(`${lang}.json`, JSON.stringify(json, null, 2));
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${gameName || 'translations'}.zip`);
  };

  return (
    <div className="App" style={{ padding: 20 }}>
      <h2>📁 Excel Language Folder to Structured JSON</h2>
      <input type="file" webkitdirectory="true" multiple onChange={handleFolderUpload} />

      <div style={{ marginTop: 20 }}>
        <label><strong>🎮 Enter Game Name: </strong></label>
        <input
          type="text"
          value={gameName}
          onChange={(e) => setGameName(e.target.value)}
          placeholder="Enter game name..."
          style={{ marginLeft: 10, padding: '4px 8px' }}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <h4>🛠️ Manage Mapping Keys (Drag to Reorder)</h4>
        <input
          type="text"
          placeholder="Add new key..."
          value={newOption}
          onChange={(e) => setNewOption(e.target.value)}
          style={{ marginRight: 10 }}
        />
        <button onClick={handleAddOption}>Add Key</button>
        <button
          style={{ marginLeft: 10 }}
          onClick={() =>
            setDropdownOptions(['game', 'rtp', 'description', 'wins', 'wild', 'scatter', 'features'])
          }
        >
          🔁 Restore Default Keys
        </button>

        <ul style={{ listStyle: 'none', padding: 0, marginTop: 10 }}>
          {dropdownOptions.map((opt, idx) => (
            <li
              key={opt}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={() => handleDragOver(idx)}
              style={{
                padding: '4px 10px',
                marginBottom: 4,
                backgroundColor: '#eee',
                display: 'flex',
                justifyContent: 'space-between',
                cursor: 'grab'
              }}
            >
              <span>☰ {opt}</span>
              <button
                onClick={() => handleRemoveOption(opt)}
                style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                ❌
              </button>
            </li>
          ))}
        </ul>
      </div>

      {langData['en']?.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h3>🗂️ Assign Keys for EN File</h3>
          {langData['en'].slice(1).map((line, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div>
                <input
                  type="checkbox"
                  checked={customHeaders[idx]}
                  onChange={() =>
                    setCustomHeaders(prev => ({
                      ...prev,
                      [idx]: !prev[idx],
                    }))
                  }
                />
                <strong style={{ color: customHeaders[idx] ? 'blue' : 'black', marginLeft: 8 }}>
                  {line}
                </strong>
              </div>
              {!customHeaders[idx] && (
                <button
                  onClick={() => handleDeleteLine(idx)}
                  style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}
                >
                  🗑️
                </button>
              )}
              {customHeaders[idx] && (
                <select
                  value={mapping[line] || ''}
                  onChange={(e) => handleMappingChange(line, e.target.value)}
                  style={{ marginLeft: 10 }}
                >
                  <option value="">--Assign to--</option>
                  {dropdownOptions.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
              {mapping[line] && (
                <button
                  onClick={() => handleDeleteMappingLine(line)}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: 'red',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ❌
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {Object.keys(mapping).length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h3>🌐 Final JSON Output per Language</h3>
          {Object.keys(langData).map(lang => (
            <div key={lang} style={{ border: '1px solid #999', margin: '10px 0', padding: 10 }}>
              <h4>{lang.toUpperCase()}</h4>
              <pre style={{ background: '#f9f9f9', padding: 10 }}>
                {JSON.stringify(buildJson(lang), null, 2)}
              </pre>
            </div>
          ))}
          <button onClick={handleExport} style={{ marginTop: 20 }}>⬇️ Export All JSON Files (ZIP)</button>
        </div>
      )}
    </div>
  );
}

export default App;