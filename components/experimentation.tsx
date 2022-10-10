import Link from 'next/link'


export const ExperimentHeader = ({ experiment }) => {
    var groups = experiment && experiment.groups ? [{ name: 'All' }].concat(experiment.groups).map((group, i) => {
        const url = new URL(window.location.href)
        var searchParams = new URLSearchParams(window.location.search)
        searchParams.set('group', group.name)
        url.search = new URLSearchParams(searchParams)

        return { url, name: group.name }
    }) : null

    return experiment ? <header className="bg-slate-600 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div>
            <div className="sm:hidden">
              <label htmlFor="tabs" className="sr-only">
                Select a group
              </label>
              {/* Use an "onChange" listener to redirect the user to the selected tab URL. */}
              <select
                id="tabs"
                name="tabs"
                className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                defaultValue={groups && experiment && experiment.current && groups.find((group) => group.name === (experiment && experiment.current)).name}
              >
                {groups && groups.map((group) => (
                  <option key={group.name}>{group.name}</option>
                ))}
              </select>
            </div>
            <div className="hidden sm:block relative">
              <div>
                <nav className="-mb-px h-12 flex items-center justify-between" aria-label="Tabs">
                    <div className="hidden md:block space-x-8">
                      {groups && groups.map((group) => <Link href={group.url.toString()} key={group.name}>
                          <a className={experiment && experiment.current === group.name ? ' font-bold' : ''}>
                              {group.name === 'All' ? group.name : `Group ${group.name}`}
                          </a>
                      </Link>)}
                    </div>
                </nav>
              </div>

              <div className='absolute top-0 right-0 pt-4 pr-4'>
                  {experiment && experiment.groups ? <a onClick={() => {
                      if (window.confirm('Are you sure you want to remove your experiment? This will delete all the changes you have made to individual groups. It will, however, preserve the "All" group')){
                          setExperiment()
                      }
                  }}>Remove experiment</a> : null}
              </div>

            </div>
          </div>
      </div>
    </header> : null
}
