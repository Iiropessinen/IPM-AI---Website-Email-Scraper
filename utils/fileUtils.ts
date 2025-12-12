import * as XLSX from 'xlsx';
import { WebsiteData } from '../types';

export const parseFile = async (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return resolve([]);

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Flatten and look for URL-like strings
        const urls: string[] = [];
        const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;

        jsonData.forEach(row => {
          row.forEach(cell => {
            if (typeof cell === 'string') {
              const trimmed = cell.trim();
              if (urlRegex.test(trimmed)) {
                urls.push(trimmed);
              }
            }
          });
        });

        // Dedup
        resolve(Array.from(new Set(urls)));
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

export const parseText = (text: string): string[] => {
  const lines = text.split(/[\n,;]+/); // Split by newline, comma, or semicolon
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
  
  const urls = lines
    .map(line => line.trim())
    .filter(line => line.length > 0 && urlRegex.test(line)); // Basic validation

  return Array.from(new Set(urls));
};

export const exportToExcel = (data: WebsiteData[]) => {
  const exportData = data.map(item => ({
    Website: item.url,
    Status: item.status,
    Emails: item.emails.join(', '),
    Note: item.error || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Emails");
  
  XLSX.writeFile(workbook, `email_extraction_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
