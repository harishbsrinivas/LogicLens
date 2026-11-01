# frozen_string_literal: true

require "unicode_normalize/normalize"

module Slug
  MAX_LENGTH = 60
  RESERVED = %w[new edit admin api].freeze

  module_function

  # Turns a title into a URL slug: ASCII, lowercase, hyphen separated.
  def slugify(title, taken: [])
    base = title
      .unicode_normalize(:nfkd)
      .encode("ASCII", invalid: :replace, undef: :replace, replace: "")
      .downcase
      .gsub(/[^a-z0-9]+/, "-")
      .gsub(/\A-+|-+\z/, "")
    base = "item" if base.empty?
    base = base[0, MAX_LENGTH].sub(/-+\z/, "")
    base = "#{base}-1" if RESERVED.include?(base)
    unique(base, taken)
  end

  def unique(base, taken)
    return base unless taken.include?(base)

    n = 2
    n += 1 while taken.include?("#{base}-#{n}")
    "#{base}-#{n}"
  end
end

if $PROGRAM_NAME == __FILE__
  ARGV.each { |title| puts Slug.slugify(title) }
end
