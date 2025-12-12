import React from 'react';
import { WebsiteData, ExtractionStatus } from '../types';
import { CheckCircle, AlertCircle, Loader2, Mail, ExternalLink, XCircle } from 'lucide-react';

interface ResultsTableProps {
  data: WebsiteData[];
  onRemove: (id: string) => void;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data, onRemove }) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
          <Mail className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-900">No websites added yet</h3>
        <p className="text-slate-500 max-w-sm mx-auto mt-1">
          Add websites above to start finding email addresses.
        </p>
      </div>
    );
  }

  const getStatusIcon = (status: ExtractionStatus) => {
    switch (status) {
      case ExtractionStatus.COMPLETED:
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case ExtractionStatus.PROCESSING:
        return <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />;
      case ExtractionStatus.FAILED:
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case ExtractionStatus.PENDING:
        return <div className="w-2 h-2 rounded-full bg-slate-300" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: ExtractionStatus) => {
    const baseClasses = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (status) {
      case ExtractionStatus.COMPLETED:
        return <span className={`${baseClasses} bg-emerald-100 text-emerald-800`}>{getStatusIcon(status)} Done</span>;
      case ExtractionStatus.PROCESSING:
        return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>{getStatusIcon(status)} Scouting...</span>;
      case ExtractionStatus.FAILED:
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>{getStatusIcon(status)} Failed</span>;
      default:
        return <span className={`${baseClasses} bg-slate-100 text-slate-600`}>Pending</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">
                Website
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/6">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Found Emails
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {data.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-sm font-medium text-slate-900 truncate max-w-[200px]" title={row.url}>
                      {row.url}
                    </div>
                    <a 
                      href={row.url.startsWith('http') ? row.url : `https://${row.url}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-2 text-slate-400 hover:text-primary-500"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(row.status)}
                </td>
                <td className="px-6 py-4">
                  {row.emails.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {row.emails.map((email, idx) => (
                        <span 
                          key={idx} 
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 select-all"
                        >
                          {email}
                        </span>
                      ))}
                    </div>
                  ) : (
                    row.status === ExtractionStatus.COMPLETED && (
                      <span className="text-xs text-slate-400 italic">No emails found</span>
                    )
                  )}
                  {row.error && (
                    <span className="text-xs text-red-500 block mt-1">{row.error}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => onRemove(row.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;
