import Layout from "@components/layout/Layout";
import { ReactElement } from "react";

function Page() {
  return <p>hello world</p>;
}

Page.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default Page;
