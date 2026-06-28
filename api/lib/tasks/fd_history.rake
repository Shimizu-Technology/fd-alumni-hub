require "json"

namespace :fd do
  namespace :history do
    desc "Seed/update the FD Alumni tournament champion archive"
    task seed_champions: :environment do
      result = DataImport::FdChampionHistoryImport.call
      puts JSON.pretty_generate(result)
    end
  end
end
