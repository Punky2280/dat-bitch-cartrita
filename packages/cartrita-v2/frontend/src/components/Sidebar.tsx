import React from 'react';

const Sidebar = () => {
  return (
    <div className="w-64 bg-gray-900 text-white p-2 flex flex-col">
      <div className="flex-1">
        <button className="w-full text-left p-2 rounded-lg hover:bg-gray-700">
          + New Chat
        </button>
        <div className="mt-4">
          <h2 className="text-xs text-gray-400 font-semibold px-2">History</h2>
          <ul className="mt-2">
            <li className="p-2 rounded-lg hover:bg-gray-700 cursor-pointer">
              Conversation 1
            </li>
            <li className="p-2 rounded-lg hover:bg-gray-700 cursor-pointer">
              Conversation 2
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;