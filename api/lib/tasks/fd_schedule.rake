namespace :fd do
  namespace :schedule do
    desc "Import the 2026 FDMSAA Alumni Basketball pool-play schedule"
    task import_2026: :environment do
      overwrite = ENV["FD_SCHEDULE_IMPORT_OVERWRITE"] == "1"
      result = DataImport::Fd2026ScheduleImport.call(path: ENV["SCHEDULE_PATH"], overwrite: overwrite)
      puts JSON.pretty_generate(result)
    end
  end
end
