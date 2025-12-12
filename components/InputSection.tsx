import React, { useState, useRef } from 'react';
import { Upload, Link as LinkIcon, FileSpreadsheet, X, Target } from 'lucide-react';
import { parseFile, parseText } from '../utils/fileUtils';

interface InputSectionProps {
  onUrlsExtracted: (urls: string[]) => void;
  isProcessing: boolean;
  targetAudience: string;
  setTargetAudience: (value: string) => void;
}

const InputSection: React.FC<InputSectionProps> = ({ 
  onUrlsExtracted, 
  isProcessing,
  targetAudience,
  setTargetAudience
}) => {
  const [textInput, setTextInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextInput(e.target.value);
  };

  const processUrls = (urls: string[]) => {
    if (urls.length > 0) {
      onUrlsExtracted(urls);
      setTextInput(''); // Clear input after successful extraction
    } else {
      alert("No valid URLs found.");
    }
  };

  const handleManualSubmit = () => {
    const urls = parseText(textInput);
    processUrls(urls);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const urls = await parseFile(e.target.files[0]);
        processUrls(urls);
      } catch (err) {
        console.error(err);
        alert("Failed to parse file. Please ensure it is a valid Excel or CSV file.");
      }
      // Reset value so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      try {
        const urls = await parseFile(e.dataTransfer.files[0]);
        processUrls(urls);
      } catch (err) {
        alert("Failed to parse file.");
      }
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
      
      {/* Target Audience Configuration */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
          <Target className="w-4 h-4 text-primary-600" />
          Scouting Goal / Target Audience (Optional)
        </label>
        <div className="relative">
          <input
            type="text"
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            placeholder="e.g. Selling AI receptionists to CEOs, or Finding Marketing Directors for partnership"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            disabled={isProcessing}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Describe who you want to contact. We will prioritize finding those specific people, but will fall back to general emails if they aren't available.
          </p>
        </div>
      </div>

      <div className="h-px bg-slate-100 mb-8 w-full"></div>

      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Manual Input */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            Paste Websites (One per line)
          </label>
          <div className="relative">
            <textarea
              className="w-full h-40 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none text-sm"
              placeholder="example.com&#10;https://company.org&#10;www.business.net"
              value={textInput}
              onChange={handleTextChange}
              disabled={isProcessing}
            />
            {textInput && (
              <button
                onClick={() => setTextInput('')}
                className="absolute top-2 right-2 p-1 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            onClick={handleManualSubmit}
            disabled={!textInput.trim() || isProcessing}
            className="mt-3 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add from Text
          </button>
        </div>

        {/* Divider */}
        <div className="hidden md:flex items-center justify-center">
          <div className="h-full w-px bg-slate-200"></div>
        </div>

        {/* File Upload */}
        <div className="flex-1">
           <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Upload Excel / CSV
          </label>
          <div
            className={`h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center p-4 transition-colors ${
              dragActive 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
          >
            <Upload className={`w-8 h-8 mb-2 ${dragActive ? 'text-primary-600' : 'text-slate-400'}`} />
            <p className="text-sm text-slate-600 font-medium">
              Click to upload or drag & drop
            </p>
            <p className="text-xs text-slate-400 mt-1">
              .xlsx, .xls, .csv
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputSection;