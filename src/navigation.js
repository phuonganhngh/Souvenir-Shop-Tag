export function tagNavigation(activePage) {
  return `<nav class="tag-nav" aria-label="タグ作成ページ"><a class="button ghost" href="./shop.html"${activePage === 'shop' ? ' aria-current="page"' : ''}>販売タグ</a><a class="button ghost" href="./restaurant.html"${activePage === 'restaurant' ? ' aria-current="page"' : ''}>料理タグ</a></nav>`;
}
