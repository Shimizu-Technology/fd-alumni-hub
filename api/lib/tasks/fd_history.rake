require "json"

namespace :fd do
  namespace :history do
    desc "Seed/update the verified FD Alumni archive, including games, articles and video"
    task enrich: :environment do
      puts JSON.pretty_generate(DataImport::FdEnrichedArchiveImport.call)
    end

    desc "Seed/update the FD Alumni tournament champion archive"
    task seed_champions: :environment do
      result = DataImport::FdChampionHistoryImport.call
      puts JSON.pretty_generate(result)
    end
  end
end
