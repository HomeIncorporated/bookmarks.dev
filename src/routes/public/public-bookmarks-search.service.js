const Bookmark = require('../../model/bookmark');
const escapeStringRegexp = require('escape-string-regexp');
const bookmarksSearchHelper = require('../../common/bookmarks-search.helper');

let findPublicBookmarks = async function (query, page, limit, sort) {
  //split in text and tags
  const searchedTermsAndTags = bookmarksSearchHelper.splitSearchQuery(query);
  const searchedTerms = searchedTermsAndTags.terms;
  const searchedTags = searchedTermsAndTags.tags;
  let bookmarks = [];

  const {specialSearchFilters, nonSpecialSearchTerms} = bookmarksSearchHelper.extractSpecialSearchTerms(searchedTerms);

  if ( searchedTerms.length > 0 && searchedTags.length > 0 ) {
    bookmarks = await getPublicBookmarksForTagsAndTerms(searchedTags, nonSpecialSearchTerms, page, limit, sort, specialSearchFilters);
  } else if ( searchedTerms.length > 0 ) {
    bookmarks = await getPublicBookmarksForSearchedTerms(nonSpecialSearchTerms, page, limit, sort, specialSearchFilters);
  } else if ( searchedTags.length > 0 ) {
    bookmarks = await getPublicBookmarksForSearchedTags(searchedTags, page, limit, specialSearchFilters);
  }

  return bookmarks;
}

let addSpecialSearchFiltersToMongoFilter = function (specialSearchFilters, filter) {
  if ( specialSearchFilters.userId ) {
    filter.userId = specialSearchFilters.userId;
  }

  if ( specialSearchFilters.lang ) {
    filter.language = specialSearchFilters.lang
  }

  if ( specialSearchFilters.site ) {
    filter.location = new RegExp(specialSearchFilters.site, 'i');
  }
};


let getPublicBookmarksForTagsAndTerms = async function (searchedTags, nonSpecialSearchTerms, page, limit, sort, specialSearchFilters) {
  let filter = {
    public: true,
    tags:
      {
        $all: searchedTags
      }
  }

  if ( nonSpecialSearchTerms.length > 0 ) {
    filter.$text =
      {
        $search: nonSpecialSearchTerms.join(' ')
      }
  }

  addSpecialSearchFiltersToMongoFilter(specialSearchFilters, filter);
  let sortBy = {};
  if ( sort === 'newest' ) {
    sortBy.createdAt = -1;
  } else {
    sortBy.score = {$meta: "textScore"}
  }

  let bookmarks = await Bookmark.find(
    filter,
    {
      score: {$meta: "textScore"}
    }
  )
    .sort(sortBy)
    .lean()
    .exec();

  for ( const term of nonSpecialSearchTerms ) {
    bookmarks = bookmarks.filter(bookmark => bookmarksSearchHelper.bookmarkContainsSearchedTerm(bookmark, term.trim()));
  }

  const startPoint = (page - 1) * limit;
  bookmarks = bookmarks.slice(startPoint, startPoint + limit);

  return bookmarks;
}

let getPublicBookmarksForSearchedTerms = async function (nonSpecialSearchTerms, page, limit, sort, specialSearchFilters) {

  let filter = {
    public: true
  }

  if ( nonSpecialSearchTerms.length > 0 ) {
    const termsJoined = nonSpecialSearchTerms.join(' ');
    const termsQuery = escapeStringRegexp(termsJoined);
    filter.$text = {$search: termsQuery};
  }

  addSpecialSearchFiltersToMongoFilter(specialSearchFilters, filter);

  let sortBy = {};
  if ( sort === 'newest' ) {
    sortBy.createdAt = -1;
  } else {
    sortBy.score = {$meta: "textScore"}
  }

  let bookmarks = await Bookmark.find(
    filter,
    {
      score: {$meta: "textScore"}
    }
  )
    .sort(sortBy)
    .lean()
    .exec();

  for ( const term of nonSpecialSearchTerms ) {
    bookmarks = bookmarks.filter(bookmark => bookmarksSearchHelper.bookmarkContainsSearchedTerm(bookmark, term.trim()));
  }
  const startPoint = (page - 1) * limit;
  bookmarks = bookmarks.slice(startPoint, startPoint + limit);

  return bookmarks;
}

let getPublicBookmarksForSearchedTags = async function (searchedTags, page, limit, specialSearchFilters) {
  let filter = {
    public: true,
    tags:
      {
        $all: searchedTags
      }
  }

  addSpecialSearchFiltersToMongoFilter(specialSearchFilters, filter);

  let bookmarks = await Bookmark.find(filter)
    .sort({createdAt: -1})
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()
    .exec();

  return bookmarks;
}

let getPublicBookmarksForUser = async function (limit, page, userId) {

  let filter = {
    public: true,
    userId: userId
  }

  let bookmarks = await Bookmark.find(filter)
    .sort({createdAt: -1})
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()
    .exec();

  return bookmarks;
}

module.exports = {
  findPublicBookmarks: findPublicBookmarks
}
