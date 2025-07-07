import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
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

  const handleFolderUpload = async (e) => {
    const fileList = Array.from(e.target.files);
    const excelFiles = fileList.filter(f => f.name.endsWith('.xlsx') && !f.name.startsWith('~$'));

    const langParsed = {};

    for (const file of excelFiles) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.worksheets[0];

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

      const lang = file.name.split('.')[0];
      langParsed[lang] = pairs;
    }

    setLangData(langParsed);
    setGameName(langParsed['en']?.[0]?.header || '');
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
    const essentialKeys = ['game', 'rtp', 'description', 'wins', 'wild', 'scatter', 'features'];
    if (essentialKeys.includes(opt)) {
      alert(`"${opt}" is a core key and cannot be removed.`);
      return;
    }

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
  const handleDeleteLine = (itemIdx, lineIdx) => {
    setLangData(prevData => {
      const updated = { ...prevData };
      Object.keys(updated).forEach(lang => {
        const lines = updated[lang][itemIdx + 1].content.split('\n');
        lines.splice(lineIdx, 1);
        updated[lang][itemIdx + 1].content = lines.join('\n');
      });
      return updated;
    });
  };

  const handleDragOver = (index) => {
    if (dragIndex === null || dragIndex === index) return;
    const newOrder = [...dropdownOptions];
    const dragged = newOrder.splice(dragIndex, 1)[0];
    newOrder.splice(index, 0, dragged);
    setDropdownOptions(newOrder);
    setDragIndex(index);
  };

  const buildJson = (lang) => {
    const pairs = langData[lang] || [];
    const output = {
      header: gameName,
      game: { header: '', content: '' },
      rtp: { header: '', content: '' },
      description: { header: '', content: '' },
      wins: { header: '', content: '' },
      wild: { header: '', content: '' },
      scatter: { header: '', content: '' },
      features: []
    };

    pairs.slice(1).forEach(item => {
      const mappedKey = mapping[item.header];
      if (!mappedKey) return;
      if (mappedKey === 'features') {
        output.features.push({ header: item.header, content: item.content });
      } else {
        output[mappedKey] = { header: item.header, content: item.content };
      }
    });

    return output;
  };

  const handleExport = () => {
    Object.keys(langData).forEach(lang => {
      const json = buildJson(lang);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      saveAs(blob, `${lang}.json`);
    });
  };

  return (
    <div className="App" style={{ padding: 20 }}>
      <h2>📁 Excel Language Folder to Structured JSON</h2>
      <input type="file" webkitdirectory="true" multiple onChange={handleFolderUpload} />

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
          {langData['en'].slice(1).map((item, idx) => (
            <div key={idx} style={{ border: '1px solid #ccc', padding: 10, marginBottom: 10, position: 'relative' }}>
              <strong>{item.header}</strong>
              {item.content.split('\n').map((line, lineIdx) => (
                <div key={lineIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{line}</span>
                  <button
                    onClick={() => handleDeleteLine(idx, lineIdx)}
                    style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}
                  >
                    🗑️
                  </button>
                </div>
              ))}

              <select
                value={mapping[item.header] || ''}
                onChange={(e) => handleMappingChange(item.header, e.target.value)}
              >
                <option value="">--Assign to--</option>
                {dropdownOptions.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
              {mapping[item.header] && (
                <button
                  onClick={() => handleDeleteMappingLine(item.header)}
                  style={{
                    position: 'absolute',
                    top: 5,
                    right: 5,
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
          <button onClick={handleExport} style={{ marginTop: 20 }}>⬇️ Export All JSON Files</button>
        </div>
      )}
    </div>
  );
}

export default App;
