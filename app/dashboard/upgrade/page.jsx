import React from "react";

function Upgrade() {
  return (
    <div className="min-h-[70vh] w-full bg-white text-gray-900 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold">Choose your plan</h1>
          <p className="mt-2 text-gray-500">Simple pricing. No hidden fees.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Starter */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Starter</h3>
              <div className="mt-2 text-4xl font-bold">Free</div>
            </div>
            <ul className="space-y-3 text-sm text-gray-700 flex-1">
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> Basic course templates</li>
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> 3 projects</li>
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> Community support</li>
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> 1GB storage</li>
            </ul>
            <button className="mt-6 rounded-lg border border-primary text-primary hover:bg-primary/10 px-4 py-2 text-sm">Start for free</button>
          </div>

          {/* Lite - featured */}
          <div className="rounded-xl border border-primary/30 bg-white p-6 shadow-sm flex flex-col ring-1 ring-primary/30">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-primary">Lite</h3>
              <div className="mt-2 text-4xl font-bold">$6<span className="text-base font-medium text-gray-500">/mo</span></div>
            </div>
            <ul className="space-y-3 text-sm text-gray-700 flex-1">
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> Custom domains for projects</li>
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> 10 projects</li>
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> Email support</li>
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> 5GB storage</li>
            </ul>
            <button className="mt-6 rounded-lg bg-primary hover:bg-primary/90 text-white px-4 py-2 text-sm">Buy plan</button>
          </div>

          {/* Growth */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Growth</h3>
              <div className="mt-2 text-4xl font-bold">$10<span className="text-base font-medium text-gray-500">/mo</span></div>
            </div>
            <ul className="space-y-3 text-sm text-gray-700 flex-1">
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> All Lite features</li>
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> Priority support</li>
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> Advanced analytics</li>
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> 20GB storage</li>
            </ul>
            <button className="mt-6 rounded-lg border border-primary text-primary hover:bg-primary/10 px-4 py-2 text-sm">Buy plan</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Upgrade;